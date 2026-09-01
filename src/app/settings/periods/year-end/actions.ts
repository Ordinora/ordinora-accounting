"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { buildYearEndClosingLines, financialYearStart, type ClosingBalanceRow } from "@/lib/year-end-close";

const zero = new Prisma.Decimal(0);

export async function postYearEndClose(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot post a year-end close.");
  const input = z.object({ periodId: z.string().min(1), confirmation: z.string().trim().min(1).max(40) }).parse(Object.fromEntries(formData));

  let destination = "/settings/periods/year-end";
  try {
    const result = await db.$transaction(async (tx) => {
      const period = await tx.accountingPeriod.findFirst({ where: { id: input.periodId, tenantId: active.id } });
      if (!period) throw new Error("Accounting period not found.");
      if (period.status !== "OPEN") throw new Error("The year-end period must be open while the closing journal is posted.");
      if (period.endsOn.getUTCMonth() + 1 !== active.financialYearEndMonth || period.endsOn.getUTCDate() !== active.financialYearEndDay) throw new Error("This period does not end on the company's configured financial year end.");
      const closingYear = period.endsOn.getUTCFullYear();
      if (input.confirmation !== `CLOSE ${closingYear}`) throw new Error(`Type CLOSE ${closingYear} exactly to confirm.`);
      const startsOn = financialYearStart(period.endsOn);

      const openEarlierPeriods = await tx.accountingPeriod.count({ where: { tenantId: active.id, id: { not: period.id }, startsOn: { lte: period.endsOn }, endsOn: { gte: startsOn }, status: "OPEN" } });
      if (openEarlierPeriods) throw new Error("Close or lock every earlier accounting period in this financial year before posting the year-end close.");

      const activeClose = await tx.journal.findFirst({ where: { tenantId: active.id, source: "YEAR_END_CLOSE", status: "POSTED", accountingDate: period.endsOn } });
      if (activeClose) throw new Error(`The financial year ending ${period.endsOn.toISOString().slice(0, 10)} is already closed by journal ${activeClose.reference}.`);

      const retained = await tx.account.findFirst({ where: { tenantId: active.id, code: "3100", type: "EQUITY", isActive: true } });
      if (!retained) throw new Error("Active equity account 3100 — Retained earnings is required before the year can be closed.");

      const postedFilter: Prisma.JournalWhereInput = { tenantId: active.id, status: { in: ["POSTED", "REVERSED"] } };
      const closingFilter: Prisma.JournalWhereInput = { ...postedFilter, NOT: [{ source: "YEAR_END_CLOSE" }, { source: "REVERSAL", reversalOf: { source: "YEAR_END_CLOSE" } }] };
      const priorDate = new Date(startsOn.getTime() - 86_400_000);
      const priorAccounts = await tx.account.findMany({ where: { tenantId: active.id, type: { in: ["REVENUE", "EXPENSE"] } }, include: { lines: { where: { journal: { ...postedFilter, accountingDate: { lte: priorDate } } } } } });
      const unclosedPrior = priorAccounts.find((account) => !account.lines.reduce((sum, line) => sum.add(line.debit).sub(line.credit), zero).eq(0));
      if (unclosedPrior) throw new Error(`Close the earlier financial year first. Account ${unclosedPrior.code} — ${unclosedPrior.name} still has an unclosed brought-forward balance.`);

      const accounts = await tx.account.findMany({ where: { tenantId: active.id, type: { in: ["REVENUE", "EXPENSE"] } }, include: { lines: { where: { journal: { ...closingFilter, accountingDate: { gte: startsOn, lte: period.endsOn } } } } }, orderBy: { code: "asc" } });
      const rows: ClosingBalanceRow[] = accounts.map((account) => ({ accountId: account.id, code: account.code, name: account.name, type: account.type as "REVENUE" | "EXPENSE", debit: account.lines.reduce((sum, line) => sum.add(line.debit), zero), credit: account.lines.reduce((sum, line) => sum.add(line.credit), zero) }));
      const closing = buildYearEndClosingLines(rows, retained.id);
      if (closing.lines.length < 2) throw new Error("There are no non-zero revenue or expense balances to close for this financial year.");
      if (!closing.totalDebits.eq(closing.totalCredits)) throw new Error("The generated year-end closing journal is not balanced.");

      const previousCloses = await tx.journal.count({ where: { tenantId: active.id, source: "YEAR_END_CLOSE", accountingDate: period.endsOn } });
      const reference = `YEC-${closingYear}-${previousCloses + 1}`;
      const journal = await tx.journal.create({ data: { tenantId: active.id, periodId: period.id, reference, description: `Year-end close for the financial year ended ${period.endsOn.toISOString().slice(0, 10)}`, accountingDate: period.endsOn, status: "POSTED", source: "YEAR_END_CLOSE", createdById: user.id, approvedById: user.id, postedById: user.id, postedAt: new Date(), lines: { create: closing.lines } } });
      await tx.accountingPeriod.update({ where: { id: period.id }, data: { status: "CLOSED", lockedAt: null } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FINANCIAL_YEAR_CLOSED", entityType: "Journal", entityId: journal.id, newValues: { reference, financialYearStart: startsOn.toISOString(), financialYearEnd: period.endsOn.toISOString(), netIncome: closing.netIncome.toString(), retainedEarningsAccountId: retained.id } } });
      return { reference, netIncome: closing.netIncome.toString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    destination += `?success=${encodeURIComponent(`${result.reference} posted. Net income / (loss) ${active.defaultCurrency} ${result.netIncome} was transferred to retained earnings.`)}`;
  } catch (error) {
    destination += `?error=${encodeURIComponent(error instanceof Error ? error.message : "The financial year could not be closed.")}`;
  }
  revalidatePath("/settings/periods");
  revalidatePath("/settings/periods/year-end");
  revalidatePath("/reports");
  redirect(destination);
}
