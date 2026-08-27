import type { Prisma } from "@prisma/client";
import type { PdfSection } from "./report-pdf";
import type { ProfitLossSection, ProfitLossStatement } from "./profit-loss";

export function profitLossPdfSections(statement: ProfitLossStatement, amount: (value: Prisma.Decimal) => string): PdfSection[] {
  const section = (title: string, source: ProfitLossSection, totalLabel: string): PdfSection | null => {
    const rows = source.rows.filter((row) => !row.amount.eq(0));
    if (!rows.length || source.total.eq(0)) return null;
    return {
      title,
      rows: [...rows.map(row => ({ label: `${row.code}  ${row.name}`, amount: amount(row.amount) })), { label: totalLabel, amount: amount(source.total), strong: true }],
    };
  };
  const derived = (label: string, value: Prisma.Decimal, showWhenZero = false, final = false): PdfSection | null => value.eq(0) && !showWhenZero ? null : ({ rows: [{ label, amount: amount(value), strong: true, final }] });
  const hasContraRevenue = !statement.contraRevenue.total.eq(0);
  const hasNonOperatingActivity = !statement.otherIncome.total.eq(0) || !statement.otherExpenses.total.eq(0);
  return [
    section("Revenue", statement.revenue, hasContraRevenue ? "Total Revenue" : "Net Revenue"),
    section("Returns, Allowances & Discounts", statement.contraRevenue, "Total Returns, Allowances & Discounts"),
    hasContraRevenue ? derived("Net Revenue", statement.netRevenue) : null,
    section("Cost of Goods Sold", statement.cogs, "Total COGS"),
    derived("Gross Profit", statement.grossProfit),
    section("Direct Operating Expenses", statement.directExpenses, "Total Direct Expenses"),
    section("Operating Expenses", statement.indirectExpenses, "Total Operating Expenses"),
    derived("Operating Income (EBIT)", statement.operatingIncome, true),
    section("Other Income", statement.otherIncome, "Total Other Income"),
    section("Other Expenses", statement.otherExpenses, "Total Other Expenses"),
    hasNonOperatingActivity ? derived("Income Before Tax", statement.incomeBeforeTax, true) : null,
    section("Income Tax Expense", statement.taxExpenses, "Total Income Tax Expense"),
    derived("Net Income / (Loss)", statement.netIncome, false, true),
  ].filter((entry): entry is PdfSection => entry !== null);
}
