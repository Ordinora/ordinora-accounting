"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/accounting";
import { db } from "@/lib/db";
import { calculateReconciliation } from "@/lib/reconciliation-calculations";
import { requireActiveTenant } from "@/lib/session";
import { resolveReference } from "@/lib/reference-numbers";

const allowed = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"];
const createSchema = z.object({ accountId: z.string().min(1), reference: z.string().trim().max(40).default(""), autoReference: z.string().optional(), statementStart: z.coerce.date(), statementEnd: z.coerce.date(), statementClosingBalance: z.string().min(1) });

export async function createReconciliation(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!allowed.includes(user.staffRole ?? "")) throw new Error("Your role cannot prepare bank reconciliations.");
  const input = createSchema.parse(Object.fromEntries(formData));
  input.reference = await resolveReference({ tenantId: active.id, kind: "RECONCILIATION", date: input.statementEnd, supplied: input.reference, auto: input.autoReference === "true" });
  if (input.statementEnd < input.statementStart) throw new Error("Statement end date must be on or after the start date.");
  const account = await db.account.findFirst({ where: { id: input.accountId, tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } });
  if (!account) throw new Error("Select an active bank or cash account.");
  const overlap = await db.bankReconciliation.findFirst({ where: { tenantId: active.id, accountId: account.id, statementStart: { lte: input.statementEnd }, statementEnd: { gte: input.statementStart } } });
  if (overlap) throw new Error(`This period overlaps reconciliation ${overlap.reference}.`);
  const statementClosingBalance = new Prisma.Decimal(parseMoneyToMinor(input.statementClosingBalance).toString()).div(100);
  const created = await db.bankReconciliation.create({ data: { tenantId: active.id, accountId: account.id, reference: input.reference, statementStart: input.statementStart, statementEnd: input.statementEnd, statementClosingBalance, createdById: user.id } });
  redirect(`/reconciliations/${created.id}`);
}

export async function updateReconciliation(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!allowed.includes(user.staffRole ?? "")) throw new Error("Your role cannot update bank reconciliations.");
  const reconciliationId = z.string().min(1).parse(formData.get("reconciliationId"));
  const intent = z.enum(["save", "finalize"]).parse(formData.get("intent"));
  const reconciliation = await db.bankReconciliation.findFirst({ where: { id: reconciliationId, tenantId: active.id }, include: { account: true } });
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
  });
  redirect(intent === "finalize" ? "/reconciliations" : `/reconciliations/${reconciliationId}`);
}
