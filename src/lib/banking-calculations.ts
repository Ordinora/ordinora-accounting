import { Prisma } from "@prisma/client";
import { financialYearDateRange, type FinancialYearSettings } from "./financial-year";

export type BankLedgerInput = {
  id: string;
  debit: Prisma.Decimal.Value;
  credit: Prisma.Decimal.Value;
  accountingDate: Date;
};

export type BankLedgerRow = BankLedgerInput & {
  movement: Prisma.Decimal;
  runningBalance: Prisma.Decimal;
};

export type BankLedgerRange = {
  from?: Date;
  to?: Date;
};

export type BankingDateRange = {
  from: Date;
  to: Date;
  fromInput: string;
  toInput: string;
};

export function bankingDateRange(query: { from?: string; to?: string }, settings: FinancialYearSettings, now = new Date()): BankingDateRange {
  return financialYearDateRange(query, settings, now);
}

export function calculateBankLedger(lines: BankLedgerInput[], range: BankLedgerRange = {}) {
  let balance = new Prisma.Decimal(0);
  let openingBalance = new Prisma.Decimal(0);
  let totalDebits = new Prisma.Decimal(0);
  let totalCredits = new Prisma.Decimal(0);
  const rows: BankLedgerRow[] = [];

  for (const line of [...lines].sort((a, b) => a.accountingDate.getTime() - b.accountingDate.getTime() || a.id.localeCompare(b.id))) {
    if (range.to && line.accountingDate > range.to) continue;
    const debit = new Prisma.Decimal(line.debit);
    const credit = new Prisma.Decimal(line.credit);
    const movement = debit.sub(credit);
    balance = balance.add(movement);

    if (range.from && line.accountingDate < range.from) {
      openingBalance = balance;
      continue;
    }

    totalDebits = totalDebits.add(debit);
    totalCredits = totalCredits.add(credit);
    rows.push({ ...line, movement, runningBalance: balance });
  }

  return { rows, openingBalance, totalDebits, totalCredits, balance };
}
