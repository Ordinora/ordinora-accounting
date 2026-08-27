import { Prisma } from "@prisma/client";

export const PROFIT_LOSS_CLASSIFICATIONS = [
  "Revenue", "Contra Revenue", "Cost of Goods Sold (COGS)", "Direct Expenses",
  "Indirect Expenses", "Other Income", "Other Expenses", "Tax Expenses",
] as const;

export type ProfitLossClassification = (typeof PROFIT_LOSS_CLASSIFICATIONS)[number];
export type ProfitLossLedgerRow = {
  id: string; code: string; name: string; type: string; classification: string;
  debit: Prisma.Decimal; credit: Prisma.Decimal;
};
export type ProfitLossSection = { classification: ProfitLossClassification; rows: Array<ProfitLossLedgerRow & { amount: Prisma.Decimal }>; total: Prisma.Decimal };
export type ProfitLossStatement = {
  revenue: ProfitLossSection; contraRevenue: ProfitLossSection; cogs: ProfitLossSection;
  directExpenses: ProfitLossSection; indirectExpenses: ProfitLossSection;
  otherIncome: ProfitLossSection; otherExpenses: ProfitLossSection; taxExpenses: ProfitLossSection;
  netRevenue: Prisma.Decimal; grossProfit: Prisma.Decimal; operatingExpenses: Prisma.Decimal;
  operatingIncome: Prisma.Decimal; incomeBeforeTax: Prisma.Decimal; netIncome: Prisma.Decimal;
};

const zero = new Prisma.Decimal(0);
const normalized = (value: string) => value.trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim();

/** Maps both current and historical account labels into the standard multi-step P&L. */
export function classifyProfitLossAccount(account: Pick<ProfitLossLedgerRow, "code" | "type" | "classification">): ProfitLossClassification | null {
  const label = normalized(account.classification);
  if (account.type === "REVENUE") {
    if (label.includes("contra") || label.includes("return") || label.includes("allowance") || label.includes("discount")) return "Contra Revenue";
    if (label.includes("other") || label.includes("finance") || label.includes("non operating") || label.includes("gain")) return "Other Income";
    return "Revenue";
  }
  if (account.type !== "EXPENSE") return null;
  if (label.includes("tax") || account.code === "7000") return "Tax Expenses";
  if (label.includes("other expense") || label.includes("non operating") || label.includes("interest expense")) return "Other Expenses";
  if (label.includes("cogs") || label.includes("cost of goods sold") || label.includes("cost of sales") || /^50\d\d$/.test(account.code)) return "Cost of Goods Sold (COGS)";
  if (label.includes("indirect") || label.includes("operating expense") || label.includes("administrative")) return "Indirect Expenses";
  if (label.includes("direct")) return "Direct Expenses";
  return "Indirect Expenses";
}

export function calculateProfitLoss(rows: ProfitLossLedgerRow[]): ProfitLossStatement {
  const section = (classification: ProfitLossClassification): ProfitLossSection => {
    const selected = rows.flatMap(row => {
      if (classifyProfitLossAccount(row) !== classification) return [];
      const creditPresented = row.type === "REVENUE" && classification !== "Contra Revenue";
      const amount = creditPresented ? row.credit.sub(row.debit) : row.debit.sub(row.credit);
      return [{ ...row, amount }];
    });
    return { classification, rows: selected, total: selected.reduce((sum, row) => sum.add(row.amount), zero) };
  };
  const revenue = section("Revenue"), contraRevenue = section("Contra Revenue");
  const cogs = section("Cost of Goods Sold (COGS)"), directExpenses = section("Direct Expenses");
  const indirectExpenses = section("Indirect Expenses"), otherIncome = section("Other Income");
  const otherExpenses = section("Other Expenses"), taxExpenses = section("Tax Expenses");
  const netRevenue = revenue.total.sub(contraRevenue.total);
  const grossProfit = netRevenue.sub(cogs.total);
  const operatingExpenses = directExpenses.total.add(indirectExpenses.total);
  const operatingIncome = grossProfit.sub(operatingExpenses);
  const incomeBeforeTax = operatingIncome.add(otherIncome.total).sub(otherExpenses.total);
  const netIncome = incomeBeforeTax.sub(taxExpenses.total);
  return { revenue, contraRevenue, cogs, directExpenses, indirectExpenses, otherIncome, otherExpenses, taxExpenses, netRevenue, grossProfit, operatingExpenses, operatingIncome, incomeBeforeTax, netIncome };
}
