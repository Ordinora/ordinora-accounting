"use server";
import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { findExactStatementMatch, parseBankStatementCsv } from "@/lib/bank-statement";
import { requireActiveTenant } from "@/lib/session";

function authorize(role: string | null) { if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot import bank statements."); }

export type ImportStatementState = { error?: string };
export async function importBankStatement(_state: ImportStatementState, formData: FormData): Promise<ImportStatementState> {
  let destination: string | undefined;
  try { const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const accountId = z.string().min(1).parse(formData.get("accountId")); const file = formData.get("statement");
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) throw new Error("Select a CSV bank statement.");
  if (file.size < 1 || file.size > 2 * 1024 * 1024) throw new Error("Upload a non-empty CSV smaller than 2 MB.");
  const account = await db.account.findFirst({ where: { id: accountId, tenantId: active.id, isActive: true, type: "ASSET", reportingClassification: "Cash and cash equivalents" } }); if (!account) throw new Error("Select an active bank or cash account.");
  const parsed = parseBankStatementCsv(await file.text()); const dates = parsed.map((line) => line.transactionDate.getTime()); const from = new Date(Math.min(...dates) - 3 * 86400000), to = new Date(Math.max(...dates) + 3 * 86400000);
  const candidates = await db.journalLine.findMany({ where: { accountId, bankStatementMatch: null, journal: { tenantId: active.id, status: "POSTED", accountingDate: { gte: from, lte: to } } }, include: { journal: true } });
  const used = new Set<string>(); const lines = parsed.map((line) => { const match = findExactStatementMatch(line, candidates.filter((candidate) => !used.has(candidate.id)).map((candidate) => ({ ...candidate, accountingDate: candidate.journal.accountingDate }))); if (match) used.add(match); return { ...line, status: match ? "MATCHED" as const : "UNMATCHED" as const, matchedJournalLineId: match }; });
  const record = await db.bankStatementImport.create({ data: { tenantId: active.id, accountId, originalName: path.basename(file.name).slice(0, 240), importedById: user.id, lines: { create: lines } } });
  destination = `/banking/imports/${record.id}`;
  } catch (error) { return { error: error instanceof Error ? error.message : "The statement could not be imported." }; }
  redirect(destination!);
}

export async function updateStatementLine(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole); const lineId = z.string().min(1).parse(formData.get("lineId")); const intent = z.enum(["match", "ignore", "unmatch"]).parse(formData.get("intent"));
  const line = await db.bankStatementLine.findFirst({ where: { id: lineId, importedStatement: { tenantId: active.id } }, include: { importedStatement: true } }); if (!line) throw new Error("Statement line not found.");
  if (intent === "match") { const journalLineId = z.string().min(1).parse(formData.get("journalLineId")); const candidate = await db.journalLine.findFirst({ where: { id: journalLineId, accountId: line.importedStatement.accountId, bankStatementMatch: null, journal: { tenantId: active.id, status: "POSTED" } } }); if (!candidate || !candidate.debit.sub(candidate.credit).eq(line.amount)) throw new Error("The selected posting must belong to this account and equal the statement amount."); await db.bankStatementLine.update({ where: { id: line.id }, data: { status: "MATCHED", matchedJournalLineId: candidate.id } }); }
  else await db.bankStatementLine.update({ where: { id: line.id }, data: { status: intent === "ignore" ? "IGNORED" : "UNMATCHED", matchedJournalLineId: null } });
  revalidatePath(`/banking/imports/${line.importId}`);
}
