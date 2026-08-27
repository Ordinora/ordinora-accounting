import "server-only";
import { Prisma, type StaffRole } from "@prisma/client";
import { db } from "./db";

export type PaymentMethod = "BANK_TRANSFER" | "BANK_CHEQUE" | "CASH" | "OTHER";
export type ChequeDetails = { paymentMethod: PaymentMethod; chequeNumber?: string; chequeDate?: Date };
type Actor = { tenantId: string; userId: string; firmId: string; role: StaffRole | null };
const zero = new Prisma.Decimal(0);

export function validateChequeDetails(input: ChequeDetails) {
  if (input.paymentMethod !== "BANK_CHEQUE") return { paymentMethod: input.paymentMethod, chequeNumber: null, chequeDate: null, chequeStatus: null };
  const chequeNumber = input.chequeNumber?.trim();
  if (!chequeNumber || chequeNumber.length > 60) throw new Error("Enter a valid cheque number.");
  if (!input.chequeDate || Number.isNaN(input.chequeDate.getTime())) throw new Error("Enter the cheque date.");
  return { paymentMethod: input.paymentMethod, chequeNumber, chequeDate: input.chequeDate, chequeStatus: "ISSUED" };
}

export async function ensureUniqueChequeNumber(tx: Prisma.TransactionClient, tenantId: string, bankAccountId: string, chequeNumber: string | null) {
  if (!chequeNumber) return;
  const [direct, supplier] = await Promise.all([
    tx.payment.count({ where: { tenantId, bankAccountId, chequeNumber } }),
    tx.supplierPayment.count({ where: { tenantId, bankAccountId, chequeNumber } }),
  ]);
  if (direct + supplier > 0) throw new Error(`Cheque number ${chequeNumber} has already been used for this bank account.`);
}

function authorize(actor: Actor) {
  if (!actor.role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(actor.role)) throw new Error("Your role cannot manage bank cheques.");
}

export async function markChequeCleared(actor: Actor, kind: "DIRECT" | "SUPPLIER", id: string, clearedOn: Date) {
  authorize(actor);
  const period = await db.accountingPeriod.findFirst({ where: { tenantId: actor.tenantId, status: "OPEN", startsOn: { lte: clearedOn }, endsOn: { gte: clearedOn } } });
  if (!period) throw new Error("The clearance date must be inside an open accounting period.");
  const record = kind === "DIRECT" ? await db.payment.findFirst({ where: { id, tenantId: actor.tenantId } }) : await db.supplierPayment.findFirst({ where: { id, tenantId: actor.tenantId } });
  if (!record || record.paymentMethod !== "BANK_CHEQUE") throw new Error("Bank cheque payment not found.");
  if (record.chequeStatus === "RETURNED") throw new Error("A returned cheque cannot be marked cleared.");
  if (kind === "DIRECT") await db.payment.update({ where: { id }, data: { chequeStatus: "CLEARED", chequeClearedOn: clearedOn } });
  else await db.supplierPayment.update({ where: { id }, data: { chequeStatus: "CLEARED", chequeClearedOn: clearedOn } });
  await db.auditEvent.create({ data: { firmId: actor.firmId, tenantId: actor.tenantId, actorId: actor.userId, actorKind: "STAFF", action: "BANK_CHEQUE_CLEARED", entityType: kind === "DIRECT" ? "Payment" : "SupplierPayment", entityId: id, newValues: { chequeNumber: record.chequeNumber, clearedOn: clearedOn.toISOString() } } });
}

export async function returnBankCheque(input: { actor: Actor; kind: "DIRECT" | "SUPPLIER"; id: string; returnedOn: Date; reason: string; liabilityAccountId?: string }) {
  authorize(input.actor);
  if (input.reason.trim().length < 5) throw new Error("Enter a return reason of at least 5 characters.");
  return db.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.findFirst({ where: { tenantId: input.actor.tenantId, status: "OPEN", startsOn: { lte: input.returnedOn }, endsOn: { gte: input.returnedOn } }, orderBy: { startsOn: "desc" } });
    if (!period) throw new Error("The cheque-return date must be inside an open accounting period.");
    const payment = input.kind === "DIRECT"
      ? await tx.payment.findFirst({ where: { id: input.id, tenantId: input.actor.tenantId }, include: { bankAccount: true, lines: true } })
      : await tx.supplierPayment.findFirst({ where: { id: input.id, tenantId: input.actor.tenantId }, include: { bankAccount: true, allocations: { include: { bill: { include: { allocations: true, creditNotes: true } } } } } });
    if (!payment || payment.paymentMethod !== "BANK_CHEQUE" || !payment.chequeNumber) throw new Error("Bank cheque payment not found.");
    if (payment.chequeStatus === "RETURNED") throw new Error("This cheque has already been returned.");
    if (!payment.journalId) throw new Error("The payment journal could not be found.");
    const originalJournal = await tx.journal.findUnique({ where: { id: payment.journalId }, include: { lines: true } });
    if (!originalJournal) throw new Error("The payment journal could not be found.");

    const returnReference = `CHQ-RET-${payment.reference}`.slice(0, 40);
    const returnLines: Prisma.JournalLineCreateWithoutJournalInput[] = [{ account: { connect: { id: payment.bankAccountId } }, debit: payment.baseAmount, credit: zero, description: `Returned cheque ${payment.chequeNumber}` }];

    if (input.kind === "SUPPLIER") {
      const bankLine = originalJournal.lines.find((line) => line.accountId === payment.bankAccountId && line.credit.gt(0));
      const payableLines = originalJournal.lines.filter((line) => line.id !== bankLine?.id);
      for (const line of payableLines) returnLines.push({ account: { connect: { id: line.accountId } }, debit: line.credit, credit: line.debit, description: `Reopened by returned cheque ${payment.chequeNumber}` });
      const supplierPayment = payment as typeof payment & { allocations: Array<{ id: string; billId: string; bill: { foreignTotal: Prisma.Decimal; allocations: Array<{ foreignAmount: Prisma.Decimal }>; creditNotes: Array<{ foreignTotal: Prisma.Decimal }> } }> };
      const billIds = supplierPayment.allocations.map((allocation) => allocation.billId);
      await tx.supplierBillAllocation.deleteMany({ where: { paymentId: payment.id } });
      for (const billId of billIds) {
        const bill = await tx.supplierBill.findUniqueOrThrow({ where: { id: billId }, include: { allocations: true, creditNotes: true } });
        const allocated = bill.allocations.reduce((sum, allocation) => sum.add(allocation.foreignAmount), zero);
        const credited = bill.creditNotes.reduce((sum, note) => sum.add(note.foreignTotal), zero);
        const outstanding = bill.foreignTotal.sub(allocated).sub(credited);
        await tx.supplierBill.update({ where: { id: bill.id }, data: { status: outstanding.lte(0) ? "PAID" : allocated.gt(0) || credited.gt(0) ? "PARTIALLY_PAID" : "POSTED" } });
      }
    } else {
      const liability = await tx.account.findFirst({ where: { id: input.liabilityAccountId, tenantId: input.actor.tenantId, type: "LIABILITY", isActive: true, isControlAccount: false } });
      if (!liability) throw new Error("Select an active non-control liability account for the amount that remains payable.");
      returnLines.push({ account: { connect: { id: liability.id } }, debit: zero, credit: payment.baseAmount, description: `Amount payable after returned cheque ${payment.chequeNumber}` });
    }

    const returnJournal = await tx.journal.create({ data: { tenantId: input.actor.tenantId, periodId: period.id, reference: returnReference, description: `Returned bank cheque ${payment.chequeNumber}: ${input.reason.trim()}`, accountingDate: input.returnedOn, status: "POSTED", source: "ADJUSTMENT", sourceId: payment.id, createdById: input.actor.userId, approvedById: input.actor.userId, postedById: input.actor.userId, postedAt: new Date(), lines: { create: returnLines } } });
    const update = { chequeStatus: "RETURNED", chequeReturnedOn: input.returnedOn, chequeReturnReason: input.reason.trim(), chequeReturnJournalId: returnJournal.id };
    if (input.kind === "DIRECT") await tx.payment.update({ where: { id: payment.id }, data: update });
    else await tx.supplierPayment.update({ where: { id: payment.id }, data: update });
    await tx.auditEvent.create({ data: { firmId: input.actor.firmId, tenantId: input.actor.tenantId, actorId: input.actor.userId, actorKind: "STAFF", action: "BANK_CHEQUE_RETURNED", entityType: input.kind === "DIRECT" ? "Payment" : "SupplierPayment", entityId: payment.id, previousValues: { chequeStatus: payment.chequeStatus }, newValues: { chequeStatus: "RETURNED", returnedOn: input.returnedOn.toISOString(), returnJournalId: returnJournal.id }, reason: input.reason.trim() } });
    return returnJournal;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
