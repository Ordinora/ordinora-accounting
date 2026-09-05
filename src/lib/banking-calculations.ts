import { Prisma } from "@prisma/client";

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

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const inputValue = (date: Date) => date.toISOString().slice(0, 10);

function parsedDate(value: string | undefined, endOfDay: boolean) {
  if (!value || !datePattern.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) || inputValue(date) !== value ? null : date;
}

export function bankingDateRange(query: { from?: string; to?: string }, now = new Date()): BankingDateRange {
  const defaultTo = new Date(now);
  const defaultFrom = new Date(Date.UTC(defaultTo.getUTCFullYear(), defaultTo.getUTCMonth() - 5, 1));
  const to = parsedDate(query.to, true) ?? defaultTo;
  let from = parsedDate(query.from, false) ?? defaultFrom;

  if (from > to) from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));

  return { from, to, fromInput: inputValue(from), toInput: inputValue(to) };
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
