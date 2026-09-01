import "server-only";

import { AccountControlRole, Prisma, type StaffRole } from "@prisma/client";
import { calculateCommercialAmounts, type CommercialCalculationLine, type DocumentDiscountType } from "./commercial-calculations";
import { requireControlAccount } from "./control-accounts";
import { convertForeignToBase } from "./currency";
import { issueInventory, receiveInventory } from "./inventory-ledger";
import { isPermittedPurchaseAccount } from "./purchase-account-policy";
import { runSerializableTransaction } from "./serializable-transaction";

const zero = new Prisma.Decimal(0);
type Kind = "SALE" | "PURCHASE";
type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };

export type CommercialUpdateInput = {
  kind: Kind;
  actor: Actor;
  id: string;
  reference: string;
  dueDate: Date;
  description: string;
  reason: string;
  discountType: DocumentDiscountType;
  discountValue: string;
  lines: CommercialCalculationLine[];
};

function authorize(actor: Actor) {
  if (!actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(actor.role)) {
    throw new Error("Your role cannot update commercial transactions.");
  }
}

async function rebuildInventoryBalance(tx: Prisma.TransactionClient, tenantId: string, itemId: string, locationId: string) {
  const remaining = await tx.inventoryMovement.aggregate({
    where: { tenantId, itemId, locationId },
    _sum: { quantity: true, totalCost: true },
  });
  await tx.inventoryBalance.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    create: { itemId, locationId, quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero },
    update: { quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero },
  });
}

export async function updateCommercialDocument(input: CommercialUpdateInput) {
  authorize(input.actor);
  if (input.lines.length < 1 || input.lines.length > 50) throw new Error("A document requires between 1 and 50 lines.");
  const calculated = calculateCommercialAmounts(input.lines, input.discountType, input.discountValue);

  return runSerializableTransaction(async (tx) => {
    const document = input.kind === "SALE"
      ? await tx.salesInvoice.findFirst({ where: { id: input.id, tenantId: input.actor.tenantId }, include: { lines: true, allocations: true, creditNotes: true, period: true } })
      : await tx.supplierBill.findFirst({ where: { id: input.id, tenantId: input.actor.tenantId }, include: { lines: true, allocations: true, creditNotes: true, period: true } });
    if (!document) throw new Error(input.kind === "SALE" ? "Sales invoice not found." : "Supplier bill not found.");
    if (document.allocations.length || document.creditNotes.length) {
      throw new Error(input.kind === "SALE" ? "Delete linked receipts or credit notes before updating this invoice." : "Delete linked payments or credit notes before updating this bill.");
    }
    if (document.journalId) {
      const [reconciledLines, statementMatches] = await Promise.all([
        tx.bankReconciliationLine.count({ where: { journalLine: { journalId: document.journalId } } }),
        tx.bankStatementLine.count({ where: { matchedJournalLine: { journalId: document.journalId } } }),
      ]);
      if (reconciledLines || statementMatches) throw new Error("This transaction has a bank reconciliation or statement match. Remove that link before updating it.");
    }
    if (document.period.status !== "OPEN") throw new Error("This document belongs to a closed accounting period and cannot be updated.");
    const documentDate = "invoiceDate" in document ? document.invoiceDate : document.billDate;
    if (input.dueDate < documentDate) throw new Error("Due date cannot be before the document date.");
    if (("salesOrderId" in document && (document.salesOrderId || document.quotationId)) || ("purchaseOrderId" in document && document.purchaseOrderId)) {
      throw new Error("Line items on a document converted from an order or quotation cannot be changed because that would break the source-document quantities.");
    }
    const oldLineIds = document.lines.map((line) => line.id);
    if (input.kind === "PURCHASE" && await tx.fixedAsset.count({ where: { tenantId: input.actor.tenantId, sourceLineId: { in: oldLineIds } } })) {
      throw new Error("A line is registered as a fixed asset. Remove that fixed-asset registration before changing this bill's lines.");
    }
    if (input.kind === "SALE" && document.lines.some((line) => line.inventoryItemId)) {
      throw new Error("Inventory sales lines cannot be revised after posting because their original FIFO/average cost issue must be preserved. Reverse the invoice and post a corrected invoice instead.");
    }

    const tenant = await tx.tenant.findUniqueOrThrow({ where: { id: input.actor.tenantId } });
    const raw = calculated.lines;
    const itemIds = [...new Set(raw.flatMap((line) => line.itemId ? [line.itemId] : []))];
    const items = await tx.inventoryItem.findMany({ where: { tenantId: tenant.id, id: { in: itemIds }, isActive: true } });
    if (items.length !== itemIds.length) throw new Error("Every selected inventory item must be active and belong to this client.");
    const locationIds = [...new Set(raw.flatMap((line) => line.itemId && line.locationId ? [line.locationId] : []))];
    if (raw.some((line) => line.itemId && !line.locationId)) throw new Error("Select a stock location for every inventory item.");
    if (await tx.inventoryLocation.count({ where: { tenantId: tenant.id, id: { in: locationIds }, isActive: true } }) !== locationIds.length) {
      throw new Error("Every stock location must be active and belong to this client.");
    }

    const lines = raw.map((line) => {
      const item = line.itemId ? items.find((candidate) => candidate.id === line.itemId) : undefined;
      const accountId = item ? (input.kind === "SALE" ? item.revenueAccountId : item.inventoryAccountId) : line.accountId;
      return { ...line, item, accountId, base: convertForeignToBase(line.foreign, document.exchangeRate) };
    });
    const ordinaryIds = [...new Set(lines.filter((line) => !line.item).map((line) => line.accountId))];
    const ordinaryAccounts = await tx.account.findMany({
      where: { tenantId: tenant.id, id: { in: ordinaryIds }, isActive: true },
      select: { id: true, type: true, code: true, reportingClassification: true, isControlAccount: true, _count: { select: { inventoryAssetItems: true } } },
    });
    const validAccounts = input.kind === "SALE" ? ordinaryAccounts.every((account) => account.type === "REVENUE") : ordinaryAccounts.every(isPermittedPurchaseAccount);
    if (ordinaryAccounts.length !== ordinaryIds.length || !validAccounts) {
      throw new Error(input.kind === "SALE" ? "Every non-inventory line must use an active revenue account." : "Every non-inventory purchase line must use an active expense or permitted asset account. Use inventory items for stock purchases.");
    }

    const oldInventoryMovements = await tx.inventoryMovement.findMany({ where: { tenantId: tenant.id, sourceType: input.kind === "SALE" ? "SalesInvoice" : "SupplierBill", sourceId: document.id } });
    const affectedKeys = new Map<string, { itemId: string; locationId: string }>();
    for (const movement of oldInventoryMovements) affectedKeys.set(`${movement.itemId}:${movement.locationId}`, movement);
    for (const line of lines.filter((line) => line.item)) affectedKeys.set(`${line.item!.id}:${line.locationId}`, { itemId: line.item!.id, locationId: line.locationId! });
    if (input.kind === "PURCHASE") {
      for (const key of affectedKeys.values()) {
        const later = await tx.inventoryMovement.findFirst({
          where: { tenantId: tenant.id, itemId: key.itemId, locationId: key.locationId, sourceId: { not: document.id }, movementDate: { gte: documentDate } },
          orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
        });
        if (later) throw new Error("This inventory line has later stock activity. Reverse the bill and post a corrected bill so historical costing remains intact.");
      }
      if (tenant.inventoryCostingMethod === "FIFO") {
        const layers = await tx.inventoryCostLayer.findMany({ where: { tenantId: tenant.id, sourceType: "SupplierBill", sourceId: document.id } });
        if (layers.some((layer) => !layer.remainingQuantity.eq(layer.originalQuantity))) {
          throw new Error("Stock from this bill has already been consumed. Reverse the bill and post a corrected bill instead.");
        }
        await tx.inventoryCostLayer.deleteMany({ where: { tenantId: tenant.id, sourceType: "SupplierBill", sourceId: document.id } });
      }
      await tx.inventoryMovement.deleteMany({ where: { tenantId: tenant.id, sourceType: "SupplierBill", sourceId: document.id } });
      for (const key of affectedKeys.values()) await rebuildInventoryBalance(tx, tenant.id, key.itemId, key.locationId);
    }

    const control = await requireControlAccount(tx, tenant.id, input.kind === "SALE" ? AccountControlRole.TRADE_RECEIVABLES : AccountControlRole.TRADE_PAYABLES);
    const baseTotal = lines.reduce((sum, line) => sum.add(line.base), zero);
    const inventoryJournal: { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal; description: string }[] = [];
    for (const line of lines.filter((candidate) => candidate.item)) {
      const item = line.item!;
      const locationId = line.locationId!;
      if (input.kind === "PURCHASE") {
        const receipt = await receiveInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId, receivedOn: documentDate, quantity: line.quantity, totalValue: line.base, sourceType: "SupplierBill", sourceId: document.id });
        await tx.inventoryMovement.create({ data: { tenantId: tenant.id, itemId: item.id, locationId, type: "PURCHASE", movementDate: documentDate, quantity: line.quantity, unitCost: receipt.receiptUnitCost, totalCost: line.base, reference: input.reference, sourceType: "SupplierBill", sourceId: document.id, createdById: input.actor.userId } });
      } else {
        const issued = await issueInventory(tx, { tenantId: tenant.id, costingMethod: tenant.inventoryCostingMethod, itemId: item.id, locationId, quantity: line.quantity });
        await tx.inventoryMovement.create({ data: { tenantId: tenant.id, itemId: item.id, locationId, type: "SALE", movementDate: documentDate, quantity: line.quantity.neg(), unitCost: issued.unitCost, totalCost: issued.cost.neg(), reference: input.reference, sourceType: "SalesInvoice", sourceId: document.id, createdById: input.actor.userId } });
        inventoryJournal.push({ accountId: item.cogsAccountId, debit: issued.cost, credit: zero, description: `COGS — ${item.name}` }, { accountId: item.inventoryAccountId, debit: zero, credit: issued.cost, description: `Inventory issued — ${item.name}` });
      }
    }
    const journalLines = input.kind === "SALE"
      ? [{ accountId: control.id, debit: baseTotal, credit: zero, description: input.description }, ...lines.map((line) => ({ accountId: line.accountId, debit: zero, credit: line.base, description: line.description })), ...inventoryJournal]
      : [...lines.map((line) => ({ accountId: line.accountId, debit: line.base, credit: zero, description: line.description })), { accountId: control.id, debit: zero, credit: baseTotal, description: input.description }];

    const previousValues = { reference: document.reference, dueDate: document.dueDate.toISOString(), description: document.description, foreignTotal: document.foreignTotal.toString(), lines: document.lines.map((line) => ({ description: line.description, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), lineTotal: line.lineTotal.toString() })) };
    if (input.kind === "SALE") {
      await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: document.id } });
      await tx.salesInvoice.update({ where: { id: document.id }, data: { reference: input.reference, dueDate: input.dueDate, description: input.description, foreignSubtotal: calculated.foreignSubtotal, discountType: calculated.discountType, discountValue: calculated.discountValue, discountAmount: calculated.discountAmount, foreignTotal: calculated.foreignTotal, baseTotal, lines: { create: lines.map((line) => ({ revenueAccountId: line.accountId, inventoryItemId: line.item?.id, inventoryLocationId: line.item ? line.locationId : null, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.foreign })) } } });
    } else {
      await tx.supplierBillLine.deleteMany({ where: { billId: document.id } });
      await tx.supplierBill.update({ where: { id: document.id }, data: { reference: input.reference, dueDate: input.dueDate, description: input.description, foreignSubtotal: calculated.foreignSubtotal, discountType: calculated.discountType, discountValue: calculated.discountValue, discountAmount: calculated.discountAmount, foreignTotal: calculated.foreignTotal, baseTotal, lines: { create: lines.map((line) => ({ expenseAccountId: line.accountId, inventoryItemId: line.item?.id, inventoryLocationId: line.item ? line.locationId : null, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercent, discountAmount: line.discountAmount, lineTotal: line.foreign })) } } });
    }
    if (!document.journalId) throw new Error("The document journal is missing and cannot be safely rebuilt.");
    await tx.journalLine.deleteMany({ where: { journalId: document.journalId } });
    await tx.journal.update({ where: { id: document.journalId }, data: { reference: input.reference, description: input.description, lines: { create: journalLines } } });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: tenant.id, actorId: input.actor.userId, actorKind: "STAFF", action: input.kind === "SALE" ? "SALES_INVOICE_UPDATED" : "SUPPLIER_BILL_UPDATED", entityType: input.kind === "SALE" ? "SalesInvoice" : "SupplierBill", entityId: document.id, previousValues, newValues: { reference: input.reference, dueDate: input.dueDate.toISOString(), description: input.description, foreignTotal: calculated.foreignTotal.toString(), lines: lines.map((line) => ({ description: line.description, quantity: line.quantity.toString(), unitPrice: line.unitPrice.toString(), lineTotal: line.foreign.toString() })) }, reason: input.reason } });
    return document;
  });
}
