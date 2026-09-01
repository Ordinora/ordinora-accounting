import { Prisma } from "@prisma/client";

const zero = new Prisma.Decimal(0);

export type ClosingBalanceRow = {
  accountId: string;
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

export type YearEndClosingLine = {
  accountId: string;
  description: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
};

/** Returns the first day of the financial year ending on the supplied date. */
export function financialYearStart(financialYearEnd: Date) {
  const previousYearEnd = new Date(Date.UTC(
    financialYearEnd.getUTCFullYear() - 1,
    financialYearEnd.getUTCMonth(),
    financialYearEnd.getUTCDate(),
  ));
  previousYearEnd.setUTCDate(previousYearEnd.getUTCDate() + 1);
  return previousYearEnd;
}

/**
 * Builds the journal that resets every P&L account and transfers the balancing
 * profit or loss to retained earnings. Amounts retain their ledger precision.
 */
export function buildYearEndClosingLines(rows: ClosingBalanceRow[], retainedEarningsAccountId: string) {
  const accountLines: YearEndClosingLine[] = [];

  for (const row of rows) {
    const netDebit = row.debit.sub(row.credit);
    if (netDebit.eq(0)) continue;
    accountLines.push({
      accountId: row.accountId,
      description: `Close ${row.code} — ${row.name}`,
      debit: netDebit.lt(0) ? netDebit.abs() : zero,
      credit: netDebit.gt(0) ? netDebit : zero,
    });
  }

  const debits = accountLines.reduce((sum, line) => sum.add(line.debit), zero);
  const credits = accountLines.reduce((sum, line) => sum.add(line.credit), zero);
  const retainedMovement = debits.sub(credits);
  const retainedLine: YearEndClosingLine | null = retainedMovement.eq(0)
    ? null
    : {
        accountId: retainedEarningsAccountId,
        description: "Transfer annual net income / (loss) to retained earnings",
        debit: retainedMovement.lt(0) ? retainedMovement.abs() : zero,
        credit: retainedMovement.gt(0) ? retainedMovement : zero,
      };

  return {
    lines: retainedLine ? [...accountLines, retainedLine] : accountLines,
    netIncome: retainedMovement,
    totalDebits: retainedLine ? debits.add(retainedLine.debit) : debits,
    totalCredits: retainedLine ? credits.add(retainedLine.credit) : credits,
  };
}
