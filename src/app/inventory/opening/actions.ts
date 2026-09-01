"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";
import { withTransactionNotice } from "@/lib/transaction-notice";
import { receiveInventory } from "@/lib/inventory-ledger";

const zero = new Prisma.Decimal(0);
const header = z.object({
  reference: z.string().trim().max(40).default(""),
  autoReference: z.string().optional(),
  openingDate: z.coerce.date(),
  postingMode: z.enum(["ALLOCATE_EXISTING", "CREATE_JOURNAL"]),
  offsetAccountId: z.string().optional(),
  description: z.string().trim().min(3).max(240),
});

export async function postOpeningInventory(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot post opening inventory.");

  const input = header.parse(Object.fromEntries(formData));
  input.reference = await resolveReference({ tenantId: active.id, kind: "OPENING_INVENTORY", date: input.openingDate, supplied: input.reference, auto: input.autoReference === "true" });
  const itemIds = formData.getAll("itemId").map(String);
  const locationIds = formData.getAll("locationId").map(String);
  const quantities = formData.getAll("quantity").map(String);
  const costs = formData.getAll("unitCost").map(String);
  if (!itemIds.length || ![itemIds.length, locationIds.length, quantities.length, costs.length].every(length => length === itemIds.length)) throw new Error("Opening inventory lines are incomplete.");

  const lines = itemIds.map((itemId, index) => ({ itemId, locationId: locationIds[index], quantity: new Prisma.Decimal(quantities[index]), unitCost: new Prisma.Decimal(costs[index]) }));
  if (lines.some(line => line.quantity.lte(0) || line.unitCost.lt(0))) throw new Error("Opening quantities must be positive and unit costs cannot be negative.");
  if (new Set(lines.map(line => `${line.itemId}:${line.locationId}`)).size !== lines.length) throw new Error("Each item and location combination can appear only once.");

  await db.$transaction(async tx => {
    const [period, items, locations, existing, duplicateReference] = await Promise.all([
      tx.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN", startsOn: { lte: input.openingDate }, endsOn: { gte: input.openingDate } }, orderBy: { startsOn: "desc" } }),
      tx.inventoryItem.findMany({ where: { tenantId: active.id, id: { in: itemIds }, isActive: true }, include: { inventoryAccount: true } }),
      tx.inventoryLocation.findMany({ where: { tenantId: active.id, id: { in: locationIds }, isActive: true } }),
      tx.inventoryMovement.findMany({ where: { tenantId: active.id, OR: lines.map(line => ({ itemId: line.itemId, locationId: line.locationId })) }, select: { itemId: true, locationId: true } }),
      tx.inventoryMovement.findFirst({ where: { tenantId: active.id, reference: input.reference, sourceType: { in: ["OpeningInventory", "OpeningInventoryAllocation"] } }, select: { id: true } }),
    ]);

    if (!period) throw new Error("The opening date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
    if (items.length !== new Set(itemIds).size || locations.length !== new Set(locationIds).size) throw new Error("An item or location is invalid or inactive.");
    if (existing.length) throw new Error("Opening stock cannot be posted to an item/location that already has stock movement history.");
    if (duplicateReference) throw new Error(`Opening inventory reference ${input.reference} already exists.`);

    const itemMap = new Map(items.map(item => [item.id, item]));
    const debits = new Map<string, Prisma.Decimal>();
    const movementData: Prisma.InventoryMovementCreateManyInput[] = [];
    let total = zero;
    for (const line of lines) {
      const item = itemMap.get(line.itemId)!;
      const value = line.quantity.mul(line.unitCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      total = total.add(value);
      debits.set(item.inventoryAccountId, (debits.get(item.inventoryAccountId) ?? zero).add(value));
      movementData.push({ tenantId: active.id, itemId: item.id, locationId: line.locationId, type: "OPENING", movementDate: input.openingDate, quantity: line.quantity, unitCost: line.unitCost.toDecimalPlaces(4), totalCost: value, reference: input.reference, sourceType: input.postingMode === "ALLOCATE_EXISTING" ? "OpeningInventoryAllocation" : "OpeningInventory", createdById: user.id });
    }
    if (total.lte(0)) throw new Error("The opening inventory value must be greater than zero.");

    let journalId: string | undefined;
    if (input.postingMode === "ALLOCATE_EXISTING") {
      const accountIds = [...debits.keys()];
      const [openingLines, priorAllocations] = await Promise.all([
        tx.journalLine.findMany({ where: { accountId: { in: accountIds }, journal: { tenantId: active.id, status: "POSTED", source: "OPENING_BALANCE" } }, select: { accountId: true, debit: true, credit: true } }),
        tx.inventoryMovement.findMany({ where: { tenantId: active.id, type: "OPENING", sourceType: { in: ["OpeningInventory", "OpeningInventoryAllocation"] }, item: { inventoryAccountId: { in: accountIds } } }, include: { item: { select: { inventoryAccountId: true } } } }),
      ]);
      const ledgerByAccount = new Map<string, Prisma.Decimal>();
      for (const line of openingLines) ledgerByAccount.set(line.accountId, (ledgerByAccount.get(line.accountId) ?? zero).add(line.debit).sub(line.credit));
      const allocatedByAccount = new Map<string, Prisma.Decimal>();
      for (const movement of priorAllocations) allocatedByAccount.set(movement.item.inventoryAccountId, (allocatedByAccount.get(movement.item.inventoryAccountId) ?? zero).add(movement.totalCost));

      for (const [accountId, requested] of debits) {
        const remaining = (ledgerByAccount.get(accountId) ?? zero).sub(allocatedByAccount.get(accountId) ?? zero);
        if (requested.gt(remaining)) {
          const account = items.find(item => item.inventoryAccountId === accountId)!.inventoryAccount;
          throw new Error(`Opening inventory for ${account.code} — ${account.name} exceeds the unallocated general-ledger balance. Available: ${active.defaultCurrency} ${remaining.toFixed(2)}; entered: ${active.defaultCurrency} ${requested.toFixed(2)}.`);
        }
      }
    } else {
      const offset = input.offsetAccountId ? await tx.account.findFirst({ where: { id: input.offsetAccountId, tenantId: active.id, isActive: true, type: { in: ["EQUITY", "LIABILITY"] } } }) : null;
      if (!offset) throw new Error("Select an active equity or liability offset account.");
      const duplicateJournal = await tx.journal.findFirst({ where: { tenantId: active.id, reference: input.reference }, select: { id: true } });
      if (duplicateJournal) throw new Error(`Journal reference ${input.reference} already exists.`);
      const journal = await tx.journal.create({ data: { tenantId: active.id, periodId: period.id, reference: input.reference, description: input.description, accountingDate: input.openingDate, status: "POSTED", source: "OPENING_BALANCE", createdById: user.id, approvedById: user.id, postedById: user.id, postedAt: new Date(), lines: { create: [...[...debits].map(([accountId, debit]) => ({ accountId, debit, credit: zero, description: input.description })), { accountId: offset.id, debit: zero, credit: total, description: input.description }] } } });
      journalId = journal.id;
    }

    for (const line of lines) {
      const item = itemMap.get(line.itemId)!;
      const value = line.quantity.mul(line.unitCost).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      await receiveInventory(tx, { tenantId: active.id, costingMethod: active.inventoryCostingMethod, itemId: item.id, locationId: line.locationId, receivedOn: input.openingDate, quantity: line.quantity, totalValue: value, sourceType: input.postingMode === "ALLOCATE_EXISTING" ? "OpeningInventoryAllocation" : "OpeningInventory", sourceId: journalId ?? input.reference });
    }
    await tx.inventoryMovement.createMany({ data: movementData.map(movement => ({ ...movement, sourceId: journalId })) });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: input.postingMode === "ALLOCATE_EXISTING" ? "OPENING_INVENTORY_ALLOCATED" : "OPENING_INVENTORY_POSTED", entityType: journalId ? "Journal" : "OpeningInventoryAllocation", entityId: journalId ?? input.reference, newValues: { reference: input.reference, lines: lines.length, total: total.toString(), generalLedgerPosted: Boolean(journalId) } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  redirect(withTransactionNotice("/inventory", "inventory-opening"));
}
