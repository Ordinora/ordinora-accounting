import "server-only";
import { Prisma, StaffRole } from "@prisma/client";
import { parseMoneyToMinor } from "./accounting";
import { db } from "./db";
import { issueInventory, receiveInventory } from "./inventory-ledger";

type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
const zero = new Prisma.Decimal(0);
const qty = (value: string) => { const result = new Prisma.Decimal(value); if (result.lte(0) || result.decimalPlaces() > 4) throw new Error("Quantity must be positive with no more than four decimal places."); return result; };
const money = (value: string) => new Prisma.Decimal(parseMoneyToMinor(value).toString()).div(100);
function auth(actor: Actor) { if (!actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(actor.role)) throw new Error("Your role cannot post inventory operations."); }

async function context(tx: Prisma.TransactionClient, input: { actor: Actor; itemId: string; operationDate: Date }, locationIds: string[], offsetAccountId?: string) {
  const [tenant, period, item, locations, offset] = await Promise.all([
    tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } }),
    tx.accountingPeriod.findFirst({ where: { tenantId: input.actor.tenantId, status: "OPEN", startsOn: { lte: input.operationDate }, endsOn: { gte: input.operationDate } }, orderBy: { startsOn: "desc" } }),
    tx.inventoryItem.findFirst({ where: { id: input.itemId, tenantId: input.actor.tenantId, isActive: true } }),
    tx.inventoryLocation.findMany({ where: { tenantId: input.actor.tenantId, id: { in: locationIds }, isActive: true } }),
    offsetAccountId ? tx.account.findFirst({ where: { id: offsetAccountId, tenantId: input.actor.tenantId, isActive: true, isControlAccount: false } }) : null,
  ]);
  if (!period) throw new Error("The operation date is not inside an open accounting period. Open that month or choose another date.");
  if (!item || locations.length !== new Set(locationIds).size || (offsetAccountId && !offset)) throw new Error("Item, location, or offset account is invalid.");
  return { tenant, period, item, locations, offset };
}

export async function transferInventory(input: { actor: Actor; itemId: string; sourceLocationId: string; destinationLocationId: string; reference: string; operationDate: Date; quantity: string; reason: string }) {
  auth(input.actor); if (input.sourceLocationId === input.destinationLocationId) throw new Error("Source and destination locations must be different."); const amount = qty(input.quantity);
  return db.$transaction(async (tx) => {
    const { tenant, period, item } = await context(tx, input, [input.sourceLocationId, input.destinationLocationId]);
    const issued = await issueInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId: input.sourceLocationId, quantity: amount });
    await receiveInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId: input.destinationLocationId, receivedOn: input.operationDate, quantity: amount, totalValue: issued.cost, sourceType: "InventoryTransfer", sourceId: input.reference });
    const op = await tx.inventoryOperation.create({ data: { tenantId: tenant.id, periodId: period.id, itemId: item.id, type: "TRANSFER", reference: input.reference, operationDate: input.operationDate, sourceLocationId: input.sourceLocationId, destinationLocationId: input.destinationLocationId, quantity: amount, unitCost: issued.unitCost, totalCost: issued.cost, reason: input.reason, createdById: input.actor.userId } });
    await tx.inventoryMovement.createMany({ data: [
      { tenantId: tenant.id, itemId: item.id, locationId: input.sourceLocationId, operationId: op.id, type: "TRANSFER_OUT", movementDate: input.operationDate, quantity: amount.neg(), unitCost: issued.unitCost, totalCost: issued.cost.neg(), reference: input.reference, sourceType: "InventoryOperation", sourceId: op.id, notes: input.reason, createdById: input.actor.userId },
      { tenantId: tenant.id, itemId: item.id, locationId: input.destinationLocationId, operationId: op.id, type: "TRANSFER_IN", movementDate: input.operationDate, quantity: amount, unitCost: issued.unitCost, totalCost: issued.cost, reference: input.reference, sourceType: "InventoryOperation", sourceId: op.id, notes: input.reason, createdById: input.actor.userId },
    ] });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: "INVENTORY_TRANSFER_POSTED", entityType: "InventoryOperation", entityId: op.id, newValues: { reference: input.reference, itemId: item.id, costingMethod: tenant.inventoryCostingMethod, quantity: amount.toString(), totalCost: issued.cost.toString() } } });
    return op;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function adjustInventory(input: { actor: Actor; itemId: string; locationId: string; offsetAccountId: string; type: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT"; reference: string; operationDate: Date; quantity: string; unitCost: string; reason: string }) {
  auth(input.actor); const amount = qty(input.quantity);
  return db.$transaction(async (tx) => {
    const { tenant, period, item, locations, offset } = await context(tx, input, [input.locationId], input.offsetAccountId); const location = locations[0]; const inbound = input.type === "ADJUSTMENT_IN";
    let unitCost: Prisma.Decimal, totalCost: Prisma.Decimal;
    if (inbound) { unitCost = money(input.unitCost); totalCost = unitCost.mul(amount).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP); const received = await receiveInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId: location.id, receivedOn: input.operationDate, quantity: amount, totalValue: totalCost, sourceType: "InventoryAdjustment", sourceId: input.reference }); unitCost = received.receiptUnitCost; }
    else { const issued = await issueInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId: location.id, quantity: amount }); unitCost = issued.unitCost; totalCost = issued.cost; }
    const op = await tx.inventoryOperation.create({ data: { tenantId: tenant.id, periodId: period.id, itemId: item.id, type: input.type, reference: input.reference, operationDate: input.operationDate, sourceLocationId: inbound ? null : location.id, destinationLocationId: inbound ? location.id : null, offsetAccountId: offset!.id, quantity: amount, unitCost, totalCost, reason: input.reason, createdById: input.actor.userId } });
    await tx.inventoryMovement.create({ data: { tenantId: tenant.id, itemId: item.id, locationId: location.id, operationId: op.id, type: input.type, movementDate: input.operationDate, quantity: inbound ? amount : amount.neg(), unitCost, totalCost: inbound ? totalCost : totalCost.neg(), reference: input.reference, sourceType: "InventoryOperation", sourceId: op.id, notes: input.reason, createdById: input.actor.userId } });
    const journalLines = inbound ? [{ accountId: item.inventoryAccountId, debit: totalCost, credit: zero, description: input.reason }, { accountId: offset!.id, debit: zero, credit: totalCost, description: input.reason }] : [{ accountId: offset!.id, debit: totalCost, credit: zero, description: input.reason }, { accountId: item.inventoryAccountId, debit: zero, credit: totalCost, description: input.reason }];
    const journal = await tx.journal.create({ data: { tenantId: tenant.id, periodId: period.id, reference: input.reference, description: input.reason, accountingDate: input.operationDate, status: "POSTED", source: "INVENTORY_ADJUSTMENT", sourceId: op.id, createdById: input.actor.userId, approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(), lines: { create: journalLines } } });
    await tx.inventoryOperation.update({ where: { id: op.id }, data: { journalId: journal.id } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: "INVENTORY_ADJUSTMENT_POSTED", entityType: "InventoryOperation", entityId: op.id, newValues: { reference: input.reference, type: input.type, costingMethod: tenant.inventoryCostingMethod, quantity: amount.toString(), totalCost: totalCost.toString(), journalId: journal.id } } });
    return op;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
