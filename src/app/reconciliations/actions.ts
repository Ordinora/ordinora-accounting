"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateReconciliation, parseStatementBalance } from "@/lib/reconciliation-calculations";
import { requireActiveTenantForMutation } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";
import { withTransactionNotice } from "@/lib/transaction-notice";

const allowed = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"];
const createSchema = z.object({ accountId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference: z.string().optional(), statementStart: z.coerce.date(), statementEnd: z.coerce.date(), statementClosingBalance: z.string().min(1) });
const editSchema = createSchema.omit({ autoReference: true }).extend({ reference: z.string().trim().min(1, "Reference is required.").max(40) });

export async function createReconciliation(formData: FormData) {
  const { user, active } = await requireActiveTenantForMutation();
  if (!allowed.includes(user.staffRole ?? "")) throw new Error("Your role cannot prepare bank reconciliations.");
  const input = createSchema.parse(Object.fromEntries(formData));
  input.reference = await resolveReference({ tenantId: active.id, kind: "RECONCILIATION", date: input.statementEnd, supplied: input.reference, auto: input.autoReference === "true" });
  if (input.statementEnd < input.statementStart) throw new Error("Statement end date must be on or after the start date.");
  const account = await db.account.findFirst({ where: { id: input.accountId, tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } });
  if (!account) throw new Error("Select an active bank or cash account.");
  const overlap = await db.bankReconciliation.findFirst({ where: { tenantId: active.id, accountId: account.id, statementStart: { lte: input.statementEnd }, statementEnd: { gte: input.statementStart } } });
  if (overlap) throw new Error(`This period overlaps reconciliation ${overlap.reference}.`);
  const statementClosingBalance = parseStatementBalance(input.statementClosingBalance);
  const created = await db.$transaction(async (tx) => {
    const record = await tx.bankReconciliation.create({ data: { tenantId: active.id, accountId: account.id, reference: input.reference, statementStart: input.statementStart, statementEnd: input.statementEnd, statementClosingBalance, createdById: user.id } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "BANK_RECONCILIATION_CREATED", entityType: "BankReconciliation", entityId: record.id, newValues: { reference: record.reference, accountId: record.accountId, statementStart: record.statementStart.toISOString(), statementEnd: record.statementEnd.toISOString(), statementClosingBalance: record.statementClosingBalance.toString() } } });
    return record;
  });
  redirect(`/reconciliations/${created.id}`);
}

export async function editReconciliation(formData: FormData) {
  const { user, active } = await requireActiveTenantForMutation();
  if (!allowed.includes(user.staffRole ?? "")) throw new Error("Your role cannot edit bank reconciliations.");
  const reconciliationId = z.string().min(1).parse(formData.get("reconciliationId"));
  const input = editSchema.parse(Object.fromEntries(formData));
  if (input.statementEnd < input.statementStart) throw new Error("Statement end date must be on or after the start date.");
  const [reconciliation, account] = await Promise.all([
    db.bankReconciliation.findFirst({ where: { id: reconciliationId, tenantId: active.id }, include: { clearedLines: true } }),
    db.account.findFirst({ where: { id: input.accountId, tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } }),
  ]);
  if (!reconciliation) throw new Error("Bank reconciliation not found.");
  if (reconciliation.status === "RECONCILED") throw new Error("A completed reconciliation cannot be edited.");
  if (!account) throw new Error("Select an active bank or cash account.");
  const overlap = await db.bankReconciliation.findFirst({ where: { tenantId: active.id, id: { not: reconciliation.id }, accountId: account.id, statementStart: { lte: input.statementEnd }, statementEnd: { gte: input.statementStart } } });
  if (overlap) throw new Error(`This period overlaps reconciliation ${overlap.reference}.`);
  const statementClosingBalance = parseStatementBalance(input.statementClosingBalance);
  const scopeChanged = reconciliation.accountId !== input.accountId || reconciliation.statementStart.getTime() !== input.statementStart.getTime() || reconciliation.statementEnd.getTime() !== input.statementEnd.getTime();
  await db.$transaction(async (tx) => {
    if (scopeChanged) await tx.bankReconciliationLine.deleteMany({ where: { reconciliationId: reconciliation.id } });
    const updated = await tx.bankReconciliation.update({ where: { id: reconciliation.id }, data: { accountId: input.accountId, reference: input.reference, statementStart: input.statementStart, statementEnd: input.statementEnd, statementClosingBalance } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "BANK_RECONCILIATION_UPDATED", entityType: "BankReconciliation", entityId: updated.id, previousValues: { reference: reconciliation.reference, accountId: reconciliation.accountId, statementStart: reconciliation.statementStart.toISOString(), statementEnd: reconciliation.statementEnd.toISOString(), statementClosingBalance: reconciliation.statementClosingBalance.toString(), clearedItems: reconciliation.clearedLines.length }, newValues: { reference: updated.reference, accountId: updated.accountId, statementStart: updated.statementStart.toISOString(), statementEnd: updated.statementEnd.toISOString(), statementClosingBalance: updated.statementClosingBalance.toString(), clearedItemsReset: scopeChanged } } });
  });
  redirect(`/reconciliations/${reconciliation.id}`);
}

export async function updateReconciliation(formData: FormData) {
  const { user, active } = await requireActiveTenantForMutation();
  if (!allowed.includes(user.staffRole ?? "")) throw new Error("Your role cannot update bank reconciliations.");
  const reconciliationId = z.string().min(1).parse(formData.get("reconciliationId"));
  const intent = z.enum(["save", "finalize"]).parse(formData.get("intent"));
  const reconciliation = await db.bankReconciliation.findFirst({ where: { id: reconciliationId, tenantId: active.id }, include: { account: true, clearedLines: true } });
  if (!reconciliation) throw new Error("Bank reconciliation not found.");
  if (reconciliation.status === "RECONCILED") throw new Error("A completed reconciliation cannot be changed.");
  const candidates = await db.journalLine.findMany({ where: { accountId: reconciliation.accountId, journal: { tenantId: active.id, status: "POSTED", accountingDate: { gte: reconciliation.statementStart, lte: reconciliation.statementEnd } } }, include: { journal: true, bankStatementMatch: true } });
  const validIds = new Set(candidates.map((line) => line.id));
  const selectedIds = [...new Set([...formData.getAll("clearedLineId").map(String),...candidates.filter(line=>line.bankStatementMatch&&line.bankStatementMatch.transactionDate>=reconciliation.statementStart&&line.bankStatementMatch.transactionDate<=reconciliation.statementEnd).map(line=>line.id)])].filter((id) => validIds.has(id));
  const opening = await db.journalLine.findMany({ where: { accountId: reconciliation.accountId, journal: { tenantId: active.id, status: "POSTED", accountingDate: { lt: reconciliation.statementStart } } }, select: { debit: true, credit: true } });
  const openingBalance = opening.reduce((sum, line) => sum.add(line.debit).sub(line.credit), new Prisma.Decimal(0));
  const result = calculateReconciliation({ openingBalance, statementClosingBalance: reconciliation.statementClosingBalance, movements: candidates, clearedIds: selectedIds });
  if (intent === "finalize" && !result.difference.eq(0)) throw new Error(`Reconciliation difference must be zero. Current difference: ${active.defaultCurrency} ${result.difference.toFixed(2)}.`);
  await db.$transaction(async (tx) => {
    await tx.bankReconciliationLine.deleteMany({ where: { reconciliationId } });
    if (selectedIds.length) await tx.bankReconciliationLine.createMany({ data: selectedIds.map((journalLineId) => ({ reconciliationId, journalLineId })) });
    if (intent === "finalize") await tx.bankReconciliation.update({ where: { id: reconciliationId }, data: { status: "RECONCILED", reconciledById: user.id, reconciledAt: new Date() } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: intent === "finalize" ? "BANK_RECONCILIATION_FINALIZED" : "BANK_RECONCILIATION_MATCHING_SAVED", entityType: "BankReconciliation", entityId: reconciliationId, previousValues: { clearedJournalLineIds: reconciliation.clearedLines.map((line) => line.journalLineId) }, newValues: { clearedJournalLineIds: selectedIds, difference: result.difference.toString(), status: intent === "finalize" ? "RECONCILED" : "DRAFT" } } });
  });
  redirect(intent === "finalize" ? withTransactionNotice("/reconciliations", "reconciliation") : `/reconciliations/${reconciliationId}`);
}
