import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateBalanceSheet, type LedgerBalanceRow } from "./financial-statements";
import { balanceSheetPdfSections, buildBalanceSheetPresentation } from "./balance-sheet-report";

const d = (value: number) => new Prisma.Decimal(value);
const row = (code: string, name: string, type: string, classification: string, debit: number, credit: number): LedgerBalanceRow => ({ id: code, code, name, type, classification, debit: d(debit), credit: d(credit), balance: d(debit).sub(credit) });

describe("balance sheet presentation", () => {
  const statement = calculateBalanceSheet([
    row("1000", "Cash on hand", "ASSET", "Cash and cash equivalents", 1200, 0),
    row("1300", "Food & beverage inventory", "ASSET", "Current assets", 4800, 0),
    row("1500", "Kitchen equipment", "ASSET", "Non-current assets", 35000, 0),
    row("1510", "Furniture and fittings", "ASSET", "Non-current assets", 10000, 0),
    row("1590", "Accumulated depreciation", "ASSET", "Non-current assets", 0, 9000),
    row("2000", "Trade payables", "LIABILITY", "Current liabilities", 0, 6500),
    row("2100", "Trade payables control", "LIABILITY", "Current liabilities", 0, 0),
    row("2300", "Bank loan", "LIABILITY", "Borrowings", 0, 20000),
    row("3000", "Share capital", "EQUITY", "Equity", 0, 15500),
  ]);

  it("groups accounts, keeps contra-assets negative, and omits zero balances", () => {
    const view = buildBalanceSheetPresentation(statement);
    expect(view.currentAssets.map((item) => item.code)).toEqual(["1000", "1300"]);
    expect(view.fixedAssets.map((item) => item.code)).toEqual(["1500", "1510", "1590"]);
    expect(view.fixedAssets.find((item) => item.code === "1590")?.amount.toNumber()).toBe(-9000);
    expect(view.netFixedAssets.toNumber()).toBe(36000);
    expect(view.currentLiabilities.map((item) => item.code)).toEqual(["2000"]);
    expect(view.nonCurrentLiabilities.map((item) => item.code)).toEqual(["2300"]);
  });

  it("uses the requested labels without changing final totals", () => {
    const sections = balanceSheetPdfSections(statement, (value) => `BND ${value.toFixed(2)}`);
    const labels = sections.flatMap((section) => section.rows.map((item) => item.label));
    expect(labels).not.toContain("2100  Trade payables control");
    expect(labels).toContain("Net Fixed Assets");
    expect(labels).not.toContain("Total Non-Current Assets");
    expect(labels).toContain("Total Assets");
    expect(labels).toContain("Total Liabilities");
    expect(labels).toContain("Total Equity");
    expect(labels).toContain("Total Liabilities & Equity");
    expect(labels).not.toContain("Current earnings");
    expect(statement.difference.toNumber()).toBe(0);
  });

  it("hides empty liability sections and their totals", () => {
    const noLoanStatement = calculateBalanceSheet([
      row("1000", "Cash on hand", "ASSET", "Cash and cash equivalents", 1000, 0),
      row("2000", "Trade payables", "LIABILITY", "Current liabilities", 0, 250),
      row("3000", "Share capital", "EQUITY", "Equity", 0, 750),
    ]);
    const sections = balanceSheetPdfSections(noLoanStatement, (value) => `BND ${value.toFixed(2)}`);
    expect(sections.map((section) => section.title)).not.toContain("Non-Current Liabilities");
    expect(sections.flatMap((section) => section.rows.map((item) => item.label))).not.toContain("Total Non-Current Liabilities");
  });
});
