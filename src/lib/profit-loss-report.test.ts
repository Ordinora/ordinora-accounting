import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { ProfitLossSection, ProfitLossStatement } from "./profit-loss";
import { profitLossPdfSections } from "./profit-loss-report";

const decimal = (value: number) => new Prisma.Decimal(value);
const section = (classification: ProfitLossSection["classification"], rows: Array<[string, number]>): ProfitLossSection => ({
  classification,
  rows: rows.map(([code, amount]) => ({ id: code, code, name: `Account ${code}`, type: classification.includes("Revenue") || classification === "Other Income" ? "REVENUE" : "EXPENSE", classification, debit: decimal(0), credit: decimal(0), amount: decimal(amount) })),
  total: rows.reduce((sum, [, amount]) => sum.add(amount), decimal(0)),
});

it("omits zero P&L rows and sections before PDF drawing", () => {
  const statement = {
    revenue: section("Revenue", [["4000", 1000], ["4010", 0]]),
    contraRevenue: section("Contra Revenue", []),
    cogs: section("Cost of Goods Sold (COGS)", [["5000", 400]]),
    directExpenses: section("Direct Expenses", []),
    indirectExpenses: section("Indirect Expenses", [["6300", 100], ["6610", 0]]),
    otherIncome: section("Other Income", []),
    otherExpenses: section("Other Expenses", []),
    taxExpenses: section("Tax Expenses", []),
    netRevenue: decimal(1000), grossProfit: decimal(600), operatingExpenses: decimal(100),
    operatingIncome: decimal(500), incomeBeforeTax: decimal(500), netIncome: decimal(500),
  } satisfies ProfitLossStatement;

  const result = profitLossPdfSections(statement, (value) => `BND ${value.toFixed(2)}`);
  const text = JSON.stringify(result);
  expect(text).not.toContain("4010");
  expect(text).not.toContain("6610");
  expect(text).not.toContain("Returns, Allowances");
  expect(text).not.toContain("Other Income");
  expect(text).not.toContain("Income Tax Expense");
  expect(text).not.toContain('"label":"Subtotal"');
  expect(result[0]).toMatchObject({ title: "Revenue", rows: [{ label: "4000  Account 4000" }, { label: "Net Revenue", strong: true }] });
  expect(result.find((entry) => entry.title === "Cost of Goods Sold")?.rows.at(-1)?.label).toBe("Total COGS");
  expect(result.find((entry) => entry.title === "Operating Expenses")?.rows.at(-1)?.label).toBe("Total Operating Expenses");
  expect(result.some((entry) => /\b(?:Less|Add):/.test(entry.title ?? ""))).toBe(false);
  expect(result.find((entry) => entry.rows.some((row) => row.label === "Net Income / (Loss)"))?.rows[0].final).toBe(true);
  expect(text).not.toContain("Income Before Tax");
  for (const label of ["Gross Profit", "Operating Income (EBIT)", "Net Income / (Loss)"]) {
    const entry = result.find((candidate) => candidate.rows.some((row) => row.label === label));
    expect(entry?.title).toBeUndefined();
    expect(entry?.rows).toHaveLength(1);
  }
});

it("always shows EBIT and only shows income before tax for non-operating activity", () => {
  const base = {
    revenue: section("Revenue", []), contraRevenue: section("Contra Revenue", []), cogs: section("Cost of Goods Sold (COGS)", []),
    directExpenses: section("Direct Expenses", []), indirectExpenses: section("Indirect Expenses", []),
    otherIncome: section("Other Income", []), otherExpenses: section("Other Expenses", []), taxExpenses: section("Tax Expenses", []),
    netRevenue: decimal(0), grossProfit: decimal(0), operatingExpenses: decimal(0), operatingIncome: decimal(0), incomeBeforeTax: decimal(0), netIncome: decimal(0),
  } satisfies ProfitLossStatement;

  const withoutOtherActivity = profitLossPdfSections(base, (value) => `BND ${value.toFixed(2)}`);
  expect(withoutOtherActivity.some((entry) => entry.rows.some((row) => row.label === "Operating Income (EBIT)" && row.amount === "BND 0.00"))).toBe(true);
  expect(withoutOtherActivity.some((entry) => entry.rows.some((row) => row.label === "Income Before Tax"))).toBe(false);

  const withOtherActivity: ProfitLossStatement = {
    ...base,
    otherIncome: section("Other Income", [["4800", 25]]),
    incomeBeforeTax: decimal(25),
    netIncome: decimal(25),
  };
  const result = profitLossPdfSections(withOtherActivity, (value) => `BND ${value.toFixed(2)}`);
  expect(result.some((entry) => entry.rows.some((row) => row.label === "Income Before Tax" && row.amount === "BND 25.00"))).toBe(true);
});
