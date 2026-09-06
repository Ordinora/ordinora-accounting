import { Prisma } from "@prisma/client";

const zero = new Prisma.Decimal(0);
export type ReconciliationMovement = { id: string; debit: Prisma.Decimal.Value; credit: Prisma.Decimal.Value };

export function parseStatementBalance(input: string) {
  const normalized = input.trim().replaceAll(",", "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Enter a valid statement balance with no more than two decimal places.");
  return new Prisma.Decimal(normalized);
}

export function calculateReconciliation(input: {
  openingBalance: Prisma.Decimal.Value;
  statementClosingBalance: Prisma.Decimal.Value;
  movements: ReconciliationMovement[];
  clearedIds: Iterable<string>;
}) {
  const cleared = new Set(input.clearedIds);
  const openingBalance = new Prisma.Decimal(input.openingBalance);
  const statementClosingBalance = new Prisma.Decimal(input.statementClosingBalance);
  const movement = (line: ReconciliationMovement) => new Prisma.Decimal(line.debit).sub(line.credit);
  const ledgerMovement = input.movements.reduce((sum, line) => sum.add(movement(line)), zero);
  const clearedMovement = input.movements.filter((line) => cleared.has(line.id)).reduce((sum, line) => sum.add(movement(line)), zero);
  const ledgerClosingBalance = openingBalance.add(ledgerMovement);
  const clearedBookBalance = openingBalance.add(clearedMovement);
  const difference = statementClosingBalance.sub(clearedBookBalance);
  const outstandingMovement = ledgerClosingBalance.sub(clearedBookBalance);
  return { openingBalance, ledgerMovement, clearedMovement, ledgerClosingBalance, clearedBookBalance, statementClosingBalance, difference, outstandingMovement };
}
