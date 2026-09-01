import "server-only";
import { Prisma, StaffRole, TenderType } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";
import { issueInventory } from "./inventory-ledger";
import { runSerializableTransaction } from "./serializable-transaction";

type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
type SaleLine = { description: string; accountId: string; inventoryItemId?: string; inventoryLocationId?: string; quantity: string; unitPrice: string; discountType: "NONE" | "PERCENT" | "AMOUNT"; discountValue: string };
type Tender = { type: TenderType; accountId: string; amount: string; reference: string };
type DailySaleInput = { actor: Actor; reference: string; registerDate: Date; branchLabel: string; registerLabel: string; lines: SaleLine[]; tenders: Tender[] };
const zero = new Prisma.Decimal(0);
const money = (value: string) => new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100);

async function saveDailySale(input: DailySaleInput, existingId?: string, updateReason?: string) {
  if (!input.actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(input.actor.role)) throw new Error("Your role cannot post daily sales.");
  if (!input.lines.length || input.lines.length > 100) throw new Error("A daily sale requires between 1 and 100 sales lines.");
  if (!input.tenders.length || input.tenders.length > 10) throw new Error("A daily sale requires at least one tender line.");
  const lines = input.lines.map((line) => {
    const quantity = new Prisma.Decimal(line.quantity), unitPrice = money(line.unitPrice), gross = quantity.mul(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP), value = money(line.discountValue || "0");
    if (quantity.lte(0) || quantity.decimalPlaces() > 4) throw new Error("Sale quantities must be positive with no more than four decimal places.");
    let discountPercent = zero, discountAmount = zero;
    if (line.discountType === "PERCENT") {
      if (value.lt(0) || value.gt(100)) throw new Error("Discount percentages must be between 0 and 100.");
      discountPercent = value;
      discountAmount = gross.mul(value).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    } else if (line.discountType === "AMOUNT") {
      discountAmount = value;
      if (discountAmount.lt(0) || discountAmount.gt(gross)) throw new Error("A fixed discount cannot exceed its sales-line gross amount.");
    }
    if (Boolean(line.inventoryItemId) !== Boolean(line.inventoryLocationId)) throw new Error("Every inventory sale line requires both an item and stock location.");
    return { ...line, quantity, unitPrice, discountPercent, discountAmount, lineTotal: gross.sub(discountAmount) };
  });
  const tenders = input.tenders.map((tender) => ({ ...tender, amount: money(tender.amount) })).filter((tender) => tender.amount.gt(0));
  const salesTotal = lines.reduce((sum, line) => sum.add(line.lineTotal), zero), tenderTotal = tenders.reduce((sum, tender) => sum.add(tender.amount), zero);
  if (!salesTotal.eq(tenderTotal)) throw new Error("Tender total must equal net sales after discount.");

  return runSerializableTransaction(async (tx) => {
    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } });
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenant.id, status: "OPEN", startsOn: { lte: input.registerDate }, endsOn: { gte: input.registerDate } } });
    if (!period) throw new Error("No open accounting period contains the selected sale date. Open the required period and try again.");
    const existing = existingId ? await tx.dailyCashRegister.findFirst({ where: { id: existingId, tenantId: tenant.id }, include: { lines: true, tenders: true } }) : null;
    if (existingId && !existing) throw new Error("Daily-sales entry not found.");
    const existingJournal = existing?.journalId ? await tx.journal.findUnique({ where: { id: existing.journalId }, include: { lines: true } }) : null;
    if (existing && existingJournal) {
      if (tenant.inventoryCostingMethod === "FIFO" && existing.lines.some((line) => line.inventoryItemId)) throw new Error("Posted inventory daily sales cannot be edited after FIFO costing is enabled. Delete and repost the entry so FIFO layers remain auditable.");
      const lineIds = existingJournal.lines.map((line) => line.id);
      const [reconciled, matched] = await Promise.all([tx.bankReconciliationLine.count({ where: { journalLineId: { in: lineIds } } }), tx.bankStatementLine.count({ where: { matchedJournalLineId: { in: lineIds } } })]);
      if (reconciled || matched) throw new Error("Unmatch this daily sale from banking before editing its posted values.");
      const affected = await tx.inventoryMovement.findMany({ where: { tenantId: tenant.id, sourceType: "DailyCashRegister", sourceId: existing.id }, select: { itemId: true, locationId: true } });
      await tx.inventoryMovement.deleteMany({ where: { tenantId: tenant.id, sourceType: "DailyCashRegister", sourceId: existing.id } });
      for (const key of new Map(affected.map((row) => [`${row.itemId}:${row.locationId}`, row])).values()) {
        const remaining = await tx.inventoryMovement.aggregate({ where: { tenantId: tenant.id, itemId: key.itemId, locationId: key.locationId }, _sum: { quantity: true, totalCost: true } });
        await tx.inventoryBalance.upsert({ where: { itemId_locationId: { itemId: key.itemId, locationId: key.locationId } }, create: { itemId: key.itemId, locationId: key.locationId, quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero }, update: { quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero } });
      }
      await tx.dailyCashSaleLine.deleteMany({ where: { registerId: existing.id } });
      await tx.dailyCashTender.deleteMany({ where: { registerId: existing.id } });
      await tx.journalLine.deleteMany({ where: { journalId: existingJournal.id } });
    }
    const revenueIds = [...new Set(lines.map((line) => line.accountId))], tenderIds = [...new Set(tenders.map((tender) => tender.accountId))], inventoryLines = lines.filter((line) => line.inventoryItemId), itemIds = [...new Set(inventoryLines.map((line) => line.inventoryItemId!))], locationIds = [...new Set(inventoryLines.map((line) => line.inventoryLocationId!))];
    if (await tx.account.count({ where: { tenantId: tenant.id, id: { in: revenueIds }, isActive: true, type: "REVENUE" } }) !== revenueIds.length) throw new Error("Every sales line must use an active revenue account.");
    if (await tx.account.count({ where: { tenantId: tenant.id, id: { in: tenderIds }, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } }) !== tenderIds.length) throw new Error("Every tender must use an active cash or bank account.");
    const [items, locations] = await Promise.all([tx.inventoryItem.findMany({ where: { tenantId: tenant.id, id: { in: itemIds }, isActive: true } }), tx.inventoryLocation.findMany({ where: { tenantId: tenant.id, id: { in: locationIds }, isActive: true } })]);
    if (items.length !== itemIds.length || locations.length !== locationIds.length) throw new Error("An inventory item or stock location is invalid or inactive.");
    const itemMap = new Map(items.map((item) => [item.id, item]));
    if (inventoryLines.some((line) => itemMap.get(line.inventoryItemId!)?.revenueAccountId !== line.accountId)) throw new Error("Inventory sales must use the revenue account mapped to the item.");
    const legacyCashAccountId = tenders.find((tender) => tender.type === "CASH")?.accountId ?? tenders[0]?.accountId;
    if (!legacyCashAccountId) throw new Error("Select a deposit account for each payment tender.");
    const cashTenderTotal = tenders.filter((tender) => tender.type === "CASH").reduce((sum, tender) => sum.add(tender.amount), zero);
    const registerData = { periodId: period.id, cashAccountId: legacyCashAccountId, reference: input.reference, registerDate: input.registerDate, branchLabel: input.branchLabel || null, registerLabel: input.registerLabel || null, currency: tenant.defaultCurrency, openingFloat: zero, salesTotal, cashTenderTotal, expectedClosingCash: cashTenderTotal, actualClosingCash: cashTenderTotal, cashVariance: zero, lines: { create: lines.map((line) => ({ revenueAccountId: line.accountId, inventoryItemId: line.inventoryItemId, inventoryLocationId: line.inventoryLocationId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.lineTotal })) }, tenders: { create: tenders.map((tender) => ({ type: tender.type, accountId: tender.accountId, amount: tender.amount, reference: tender.reference || null })) } };
    const register = existing ? await tx.dailyCashRegister.update({ where: { id: existing.id }, data: registerData }) : await tx.dailyCashRegister.create({ data: { tenantId: tenant.id, createdById: input.actor.userId, ...registerData } });
    const journalLines: { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description: string }[] = tenders.map((tender) => ({ accountId: tender.accountId, debit: tender.amount, credit: zero, description: `${tender.type.replaceAll("_", " ")} sales` }));
    for (const line of lines) {
      journalLines.push({ accountId: line.accountId, debit: zero, credit: line.lineTotal, description: line.description });
      if (line.inventoryItemId && line.inventoryLocationId) {
        const item = itemMap.get(line.inventoryItemId)!;
        const issued = await issueInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId: line.inventoryLocationId, quantity: line.quantity });
        await tx.inventoryMovement.create({ data: { tenantId: tenant.id, itemId: item.id, locationId: line.inventoryLocationId, type: "SALE", movementDate: input.registerDate, quantity: line.quantity.neg(), unitCost: issued.unitCost, totalCost: issued.cost.neg(), reference: input.reference, sourceType: "DailyCashRegister", sourceId: register.id, notes: line.description, createdById: input.actor.userId } });
        journalLines.push({ accountId: item.cogsAccountId, debit: issued.cost, credit: zero, description: `COGS — ${item.name}` }, { accountId: item.inventoryAccountId, debit: zero, credit: issued.cost, description: `Inventory issued — ${item.name}` });
      }
    }
    const journalData = { periodId: period.id, reference: input.reference, description: `Daily sales${input.registerLabel ? ` — ${input.registerLabel}` : ""}`, accountingDate: input.registerDate, status: "POSTED" as const, source: "DAILY_CASH_SALES" as const, sourceId: register.id, approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(), lines: { create: journalLines } };
    const journal = existingJournal ? await tx.journal.update({ where: { id: existingJournal.id }, data: journalData }) : await tx.journal.create({ data: { tenantId: tenant.id, createdById: input.actor.userId, ...journalData } });
    await tx.dailyCashRegister.update({ where: { id: register.id }, data: { journalId: journal.id } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: existing ? "DAILY_CASH_REGISTER_VALUES_UPDATED" : "DAILY_CASH_REGISTER_POSTED", entityType: "DailyCashRegister", entityId: register.id, previousValues: existing ? { reference: existing.reference, salesTotal: existing.salesTotal.toString(), lineCount: existing.lines.length, tenderCount: existing.tenders.length } : undefined, newValues: { reference: input.reference, salesTotal: salesTotal.toString(), discountTotal: lines.reduce((sum, line) => sum.add(line.discountAmount), zero).toString(), inventoryLineCount: inventoryLines.length, lineCount: lines.length, tenderCount: tenders.length, journalId: journal.id }, reason: existing ? updateReason : undefined } });
    return register;
  });
}

export const postDailySale = (input: DailySaleInput) => saveDailySale(input);
export const updateDailySale = (input: DailySaleInput & { id: string; reason: string }) => {
  if (input.reason.trim().length < 5) throw new Error("A reason for updating posted values is required.");
  const { id, reason, ...sale } = input;
  return saveDailySale(sale, id, reason.trim());
};
