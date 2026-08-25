import "server-only";
import { JournalStatus, Prisma, StaffRole } from "@prisma/client";
import { db } from "./db";
import { parseMoneyToMinor, validateBalancedPosting } from "./accounting";

export class JournalWorkflowError extends Error {}
const zero = new Prisma.Decimal(0);

const createRoles: StaffRole[] = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"];
const reviewRoles: StaffRole[] = ["SYSTEM_ADMIN", "FIRM_ADMIN", "REVIEWER"];
const postRoles: StaffRole[] = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"];
const deleteRoles: StaffRole[] = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"];

function requireRole(role: StaffRole | null, allowed: StaffRole[]) {
  if (!role || !allowed.includes(role)) throw new JournalWorkflowError("Your role cannot perform this action.");
}

export async function createDraftJournal(input: { tenantId: string; userId: string; role: StaffRole | null; reference: string; description: string; accountingDate: Date; periodId: string; postImmediately?: boolean; lines: { accountId: string; debit: string; credit: string; description?: string }[] }) {
  requireRole(input.role, createRoles);
  const prepared = input.lines.map((line) => ({ ...line, debitMinor: line.debit ? parseMoneyToMinor(line.debit) : 0n, creditMinor: line.credit ? parseMoneyToMinor(line.credit) : 0n }));
  validateBalancedPosting(prepared.map((line) => ({ accountId: line.accountId, debitMinor: line.debitMinor, creditMinor: line.creditMinor })));
  return db.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findFirst({ where: { id: input.periodId, tenantId: input.tenantId } });
    if (!period || period.status !== "OPEN" || input.accountingDate < period.startsOn || input.accountingDate > period.endsOn) throw new JournalWorkflowError("Select an open period containing the accounting date.");
    const accountCount = await tx.account.count({ where: { tenantId: input.tenantId, id: { in: prepared.map((line) => line.accountId) }, isActive: true } });
    if (accountCount !== new Set(prepared.map((line) => line.accountId)).size) throw new JournalWorkflowError("One or more accounts do not belong to this client.");
    const journal = await tx.journal.create({ data: { tenantId: input.tenantId, periodId: input.periodId, reference: input.reference, description: input.description, accountingDate: input.accountingDate, status: input.postImmediately ? "POSTED" : "DRAFT", source: "MANUAL", createdById: input.userId, approvedById: input.postImmediately ? input.userId : null, postedById: input.postImmediately ? input.userId : null, postedAt: input.postImmediately ? new Date() : null, lines: { create: prepared.map((line) => ({ accountId: line.accountId, description: line.description, debit: new Prisma.Decimal(line.debitMinor.toString()).div(100), credit: new Prisma.Decimal(line.creditMinor.toString()).div(100) })) } } });
    await audit(tx, input, input.postImmediately ? "JOURNAL_CREATED_AND_POSTED" : "JOURNAL_DRAFT_CREATED", journal.id, { reference: journal.reference, status: journal.status });
    return journal;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

type Actor = { tenantId: string; userId: string; role: StaffRole | null };
async function audit(tx: Prisma.TransactionClient, actor: Actor, action: string, entityId: string, newValues?: Prisma.InputJsonValue, previousValues?: Prisma.InputJsonValue, reason?: string) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { firmId: true } });
  await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: actor.tenantId, actorId: actor.userId, actorKind: "STAFF", action, entityType: "Journal", entityId, newValues, previousValues, reason } });
}

export async function transitionJournal(actor: Actor, journalId: string, target: JournalStatus) {
  const rules: Record<string, { from: JournalStatus[]; roles: StaffRole[]; action: string }> = {
    IN_REVIEW: { from: ["DRAFT"], roles: createRoles, action: "JOURNAL_SUBMITTED" },
    APPROVED: { from: ["IN_REVIEW"], roles: reviewRoles, action: "JOURNAL_APPROVED" },
    POSTED: { from: ["DRAFT", "APPROVED"], roles: postRoles, action: "JOURNAL_POSTED" },
  };
  const rule = rules[target];
  if (!rule) throw new JournalWorkflowError("Unsupported journal transition.");
  requireRole(actor.role, rule.roles);
  return db.$transaction(async (tx) => {
    const journal = await tx.journal.findFirst({ where: { id: journalId, tenantId: actor.tenantId }, include: { period: true, lines: true } });
    if (!journal) throw new JournalWorkflowError("Journal not found.");
    if (!rule.from.includes(journal.status)) throw new JournalWorkflowError("Journal cannot be posted from its current status.");
    if (target === "POSTED") {
      if (journal.period.status !== "OPEN") throw new JournalWorkflowError("The accounting period is not open.");
      validateBalancedPosting(journal.lines.map((line) => ({ accountId: line.accountId, debitMinor: BigInt(line.debit.mul(100).toFixed(0)), creditMinor: BigInt(line.credit.mul(100).toFixed(0)) })));
    }
    const data = target === "APPROVED" ? { status: target, reviewedById: actor.userId, approvedById: actor.userId } : target === "POSTED" ? { status: target, postedById: actor.userId, postedAt: new Date() } : { status: target };
    const result = await tx.journal.update({ where: { id: journal.id }, data });
    await audit(tx, actor, rule.action, journal.id, { status: target }, { status: journal.status });
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reverseJournal(actor: Actor, journalId: string, reason: string) {
  requireRole(actor.role, postRoles);
  if (reason.trim().length < 5) throw new JournalWorkflowError("A reversal reason is required.");
  return db.$transaction(async (tx) => {
    const original = await tx.journal.findFirst({ where: { id: journalId, tenantId: actor.tenantId }, include: { period: true, lines: true, reversal: true } });
    if (!original || original.status !== "POSTED") throw new JournalWorkflowError("Only a posted journal can be reversed.");
    if (original.reversal) throw new JournalWorkflowError("This journal already has a reversal.");
    if (original.period.status !== "OPEN") throw new JournalWorkflowError("The accounting period is not open.");
    const reversal = await tx.journal.create({ data: { tenantId: actor.tenantId, periodId: original.periodId, reference: `REV-${original.reference}`, description: `Reversal: ${reason.trim()}`, accountingDate: original.accountingDate, status: "POSTED", source: "REVERSAL", createdById: actor.userId, approvedById: actor.userId, postedById: actor.userId, postedAt: new Date(), reversalOfId: original.id, lines: { create: original.lines.map((line) => ({ accountId: line.accountId, description: `Reversal of ${original.reference}`, debit: line.credit, credit: line.debit })) } } });
    await tx.journal.update({ where: { id: original.id }, data: { status: "REVERSED" } });
    await audit(tx, actor, "JOURNAL_REVERSED", original.id, { status: "REVERSED", reversalId: reversal.id }, { status: "POSTED" }, reason.trim());
    return reversal;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function permanentlyDeleteJournal(actor: Actor, journalId: string, confirmation: string, reason: string) {
  requireRole(actor.role, deleteRoles);
  if (reason.trim().length < 5) throw new JournalWorkflowError("A deletion reason is required.");
  return db.$transaction(async (tx) => {
    const selected = await tx.journal.findFirst({ where: { id: journalId, tenantId: actor.tenantId }, include: { period: true, lines: { select: { id: true } }, reversal: true, reversalOf: true } });
    if (!selected) throw new JournalWorkflowError("Journal not found.");
    if (confirmation.trim() !== selected.reference) throw new JournalWorkflowError(`Type ${selected.reference} exactly to confirm permanent deletion.`);
    if (selected.period.status !== "OPEN") throw new JournalWorkflowError("Transactions in a closed, locked, or finalized period cannot be permanently deleted.");
    const original = selected.reversalOfId ? await tx.journal.findUniqueOrThrow({ where: { id: selected.reversalOfId }, include: { reversal: true } }) : selected;
    const pair = original.reversal ?? (selected.reversalOf ? selected : null);
    const journalIds = [original.id, ...(pair ? [pair.id] : [])];
    const lineIds = (await tx.journalLine.findMany({ where: { journalId: { in: journalIds } }, select: { id: true } })).map((line) => line.id);
    const reconciled = await tx.bankReconciliationLine.count({ where: { journalLineId: { in: lineIds } } });
    const bankMatches = await tx.bankStatementLine.count({ where: { matchedJournalLineId: { in: lineIds } } });
    if (reconciled || bankMatches) throw new JournalWorkflowError("Remove this transaction from its bank reconciliation or statement match before deleting it.");

    await deleteJournalSource(tx, actor.tenantId, original.source, original.sourceId);
    await tx.journalLine.deleteMany({ where: { journalId: { in: journalIds } } });
    if (pair) await tx.journal.delete({ where: { id: pair.id } });
    await tx.journal.delete({ where: { id: original.id } });
    await audit(tx, actor, "JOURNAL_PERMANENTLY_DELETED", original.id, { deleted: true, reversalDeleted: Boolean(pair) }, { reference: original.reference, description: original.description, status: original.status, source: original.source, sourceId: original.sourceId }, reason.trim());
    return original.reference;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateManualJournal(input: { actor: Actor; journalId: string; reference: string; description: string; accountingDate: Date; debitAccountId: string; creditAccountId: string; amount: string; reason: string }) {
  requireRole(input.actor.role, postRoles);
  if (input.reason.trim().length < 5) throw new JournalWorkflowError("An edit reason is required.");
  const amountMinor = parseMoneyToMinor(input.amount);
  if (input.debitAccountId === input.creditAccountId) throw new JournalWorkflowError("Debit and credit accounts must be different.");
  return db.$transaction(async (tx) => {
    const journal = await tx.journal.findFirst({ where: { id: input.journalId, tenantId: input.actor.tenantId }, include: { lines: true } });
    if (!journal) throw new JournalWorkflowError("Journal not found.");
    if (journal.source !== "MANUAL") throw new JournalWorkflowError("This transaction must be edited from its source module.");
    if (journal.status === "REVERSED" || journal.reversalOfId) throw new JournalWorkflowError("A reversed transaction cannot be edited. Delete the reversal pair and enter the corrected transaction.");
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: input.actor.tenantId, status: "OPEN", startsOn: { lte: input.accountingDate }, endsOn: { gte: input.accountingDate } }, orderBy: { startsOn: "desc" } });
    if (!period) throw new JournalWorkflowError("The accounting date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
    const accounts = await tx.account.count({ where: { tenantId: input.actor.tenantId, id: { in: [input.debitAccountId, input.creditAccountId] }, isActive: true } });
    if (accounts !== 2) throw new JournalWorkflowError("Select two active accounts belonging to this company.");
    const linked = await tx.bankReconciliationLine.count({ where: { journalLineId: { in: journal.lines.map(line => line.id) } } });
    const matched = await tx.bankStatementLine.count({ where: { matchedJournalLineId: { in: journal.lines.map(line => line.id) } } });
    if (linked || matched) throw new JournalWorkflowError("Unmatch this transaction from banking before editing it.");
    const amount = new Prisma.Decimal(amountMinor.toString()).div(100);
    const previous = { reference: journal.reference, description: journal.description, accountingDate: journal.accountingDate.toISOString(), lines: journal.lines.map(line => ({ accountId: line.accountId, debit: line.debit.toString(), credit: line.credit.toString() })) };
    await tx.journalLine.deleteMany({ where: { journalId: journal.id } });
    const updated = await tx.journal.update({ where: { id: journal.id }, data: { reference: input.reference.trim(), description: input.description.trim(), accountingDate: input.accountingDate, periodId: period.id, lines: { create: [{ accountId: input.debitAccountId, description: input.description.trim(), debit: amount, credit: zero }, { accountId: input.creditAccountId, description: input.description.trim(), debit: zero, credit: amount }] } } });
    await audit(tx, input.actor, "JOURNAL_UPDATED", journal.id, { reference: updated.reference, description: updated.description, accountingDate: updated.accountingDate.toISOString(), amount: amount.toString() }, previous, input.reason.trim());
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function deleteJournalSource(tx: Prisma.TransactionClient, tenantId: string, source: string, sourceId: string | null) {
  if (!sourceId || ["MANUAL", "OPENING_BALANCE", "ADJUSTMENT", "REVERSAL"].includes(source)) return;
  const owned = { id: sourceId, tenantId };
  if (source === "SALES_INVOICE") {
    const document = await tx.salesInvoice.findFirst({ where: owned, include: { allocations: true, creditNotes: true } });
    if (!document) return;
    if (document.allocations.length || document.creditNotes.length) throw new JournalWorkflowError("This invoice has receipts or credit notes. Delete those linked transactions first.");
    await removeInventoryMovements(tx, tenantId, "SalesInvoice", sourceId); await tx.salesInvoiceLine.deleteMany({ where: { invoiceId: sourceId } }); await tx.salesInvoice.delete({ where: { id: sourceId } }); return;
  }
  if (source === "SUPPLIER_BILL") {
    const document = await tx.supplierBill.findFirst({ where: owned, include: { allocations: true, creditNotes: true } });
    if (!document) return;
    if (document.allocations.length || document.creditNotes.length) throw new JournalWorkflowError("This supplier bill has payments or credit notes. Delete those linked transactions first.");
    await removeInventoryMovements(tx, tenantId, "SupplierBill", sourceId); await tx.supplierBillLine.deleteMany({ where: { billId: sourceId } }); await tx.supplierBill.delete({ where: { id: sourceId } }); return;
  }
  if (source === "SALES_CREDIT_NOTE") { await tx.salesCreditNoteLine.deleteMany({ where: { creditNoteId: sourceId } }); await tx.salesCreditNote.deleteMany({ where: owned }); return; }
  if (source === "SUPPLIER_CREDIT_NOTE") { await tx.supplierCreditNoteLine.deleteMany({ where: { creditNoteId: sourceId } }); await tx.supplierCreditNote.deleteMany({ where: owned }); return; }
  if (source === "CUSTOMER_RECEIPT") { await tx.salesInvoiceAllocation.deleteMany({ where: { receiptId: sourceId } }); await tx.customerReceipt.deleteMany({ where: owned }); return; }
  if (source === "SUPPLIER_PAYMENT") { await tx.supplierBillAllocation.deleteMany({ where: { paymentId: sourceId } }); await tx.supplierPayment.deleteMany({ where: owned }); return; }
  if (source === "PAYMENT") { await removeInventoryMovements(tx, tenantId, "Payment", sourceId); await tx.paymentLine.deleteMany({ where: { paymentId: sourceId } }); await tx.payment.deleteMany({ where: owned }); return; }
  if (source === "INTER_ACCOUNT_TRANSFER") { await tx.interAccountTransfer.deleteMany({ where: owned }); return; }
  if (source === "DAILY_CASH_SALES") { await removeInventoryMovements(tx, tenantId, "DailyCashRegister", sourceId); await tx.dailyCashSaleLine.deleteMany({ where: { registerId: sourceId } }); await tx.dailyCashTender.deleteMany({ where: { registerId: sourceId } }); await tx.dailyCashRegister.deleteMany({ where: owned }); return; }
  if (source === "INVENTORY_ADJUSTMENT") { await removeInventoryMovements(tx, tenantId, "InventoryOperation", sourceId); await tx.inventoryOperation.deleteMany({ where: owned }); return; }
  if (source === "PAYROLL") { const run=await tx.payrollRun.findFirst({where:owned,include:{settlements:true}});if(run?.status==="LOCKED"||run?.lockedAt)throw new JournalWorkflowError("This payroll run is locked and cannot be permanently deleted.");if(run?.settlements.length)throw new JournalWorkflowError("Delete the linked payroll payments before deleting this payroll run.");await tx.payrollEntry.deleteMany({ where: { payrollRunId: sourceId } }); await tx.payrollRun.deleteMany({ where: owned }); return; }
  if (source === "PAYROLL_PAYMENT") { await tx.payrollSettlement.deleteMany({ where: owned }); return; }
  if (source === "FIXED_ASSET_DEPRECIATION") { await tx.fixedAssetDepreciation.deleteMany({ where: owned }); return; }
  if (source === "FIXED_ASSET_DISPOSAL") { const disposal = await tx.fixedAssetDisposal.findFirst({ where: owned }); if (disposal) { await tx.fixedAsset.update({ where: { id: disposal.fixedAssetId }, data: { status: "ACTIVE", disposedOn: null, disposalProceeds: null } }); await tx.fixedAssetDisposal.delete({ where: { id: disposal.id } }); } return; }
  throw new JournalWorkflowError(`Permanent deletion is not yet supported for ${source.replaceAll("_", " ").toLowerCase()} transactions.`);
}

async function removeInventoryMovements(tx: Prisma.TransactionClient, tenantId: string, sourceType: string, sourceId: string) {
  const affected = await tx.inventoryMovement.findMany({ where: { tenantId, sourceType, sourceId }, select: { itemId: true, locationId: true } });
  await tx.inventoryMovement.deleteMany({ where: { tenantId, sourceType, sourceId } });
  for (const key of new Map(affected.map((row) => [`${row.itemId}:${row.locationId}`, row])).values()) {
    const remaining = await tx.inventoryMovement.aggregate({ where: { tenantId, itemId: key.itemId, locationId: key.locationId }, _sum: { quantity: true, totalCost: true } });
    await tx.inventoryBalance.upsert({ where: { itemId_locationId: { itemId: key.itemId, locationId: key.locationId } }, create: { itemId: key.itemId, locationId: key.locationId, quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero }, update: { quantity: remaining._sum.quantity ?? zero, inventoryValue: remaining._sum.totalCost ?? zero } });
  }
}
