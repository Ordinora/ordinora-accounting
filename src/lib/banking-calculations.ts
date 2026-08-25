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

export function calculateBankLedger(lines: BankLedgerInput[]) {
  let balance = new Prisma.Decimal(0);
  let totalDebits = new Prisma.Decimal(0);
  let totalCredits = new Prisma.Decimal(0);
  const rows = [...lines]
    .sort((a, b) => a.accountingDate.getTime() - b.accountingDate.getTime() || a.id.localeCompare(b.id))
    .map((line) => {
      const debit = new Prisma.Decimal(line.debit);
      const credit = new Prisma.Decimal(line.credit);
      const movement = debit.sub(credit);
      totalDebits = totalDebits.add(debit);
      totalCredits = totalCredits.add(credit);
      balance = balance.add(movement);
      return { ...line, movement, runningBalance: balance };
    });

  return { rows, totalDebits, totalCredits, balance };
}
