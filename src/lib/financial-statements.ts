import { Prisma } from "@prisma/client";

const zero = new Prisma.Decimal(0);

export type LedgerBalanceRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  classification: string;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
};

export function calculateBalanceSheet(rows: LedgerBalanceRow[]) {
  const assets = rows.filter((row) => row.type === "ASSET");
  const liabilities = rows.filter((row) => row.type === "LIABILITY");
  const equity = rows.filter((row) => row.type === "EQUITY");
  const currentEarnings = rows
    .filter((row) => row.type === "REVENUE")
    .reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero)
    .sub(rows.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.add(row.debit.sub(row.credit)), zero));
  const totalAssets = assets.reduce((sum, row) => sum.add(row.balance), zero);
  const totalLiabilities = liabilities.reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero);
  const recordedEquity = equity.reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero);
  const designatedCurrentEarningsBalance = equity
    .filter((row) => row.code === "3200" || row.name.trim().toLowerCase() === "current-year earnings")
    .reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero);
  const potentialDuplicateCurrentEarnings = !designatedCurrentEarningsBalance.eq(0) && !currentEarnings.eq(0);
  const totalEquity = recordedEquity.add(currentEarnings);
  const totalLiabilitiesAndEquity = totalLiabilities.add(totalEquity);
  return { assets, liabilities, equity, currentEarnings, designatedCurrentEarningsBalance, potentialDuplicateCurrentEarnings, totalAssets, totalLiabilities, recordedEquity, totalEquity, totalLiabilitiesAndEquity, difference: totalAssets.sub(totalLiabilitiesAndEquity) };
}
