import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateProfitLoss, classifyProfitLossAccount } from "./profit-loss";

const row = (code: string, type: string, classification: string, debit: number, credit: number) => ({ id: code, code, name: code, type, classification, debit: new Prisma.Decimal(debit), credit: new Prisma.Decimal(credit) });

describe("multi-step profit and loss", () => {
  it("maps historical classifications into the standard buckets", () => {
    expect(classifyProfitLossAccount(row("4000", "REVENUE", "Operating revenue", 0, 0))).toBe("Revenue");
    expect(classifyProfitLossAccount(row("4300", "REVENUE", "Finance income", 0, 0))).toBe("Other Income");
    expect(classifyProfitLossAccount(row("5000", "EXPENSE", "Direct costs", 0, 0))).toBe("Cost of Goods Sold (COGS)");
    expect(classifyProfitLossAccount(row("5100", "EXPENSE", "Cost of Goods Sold (COGS)", 0, 0))).toBe("Cost of Goods Sold (COGS)");
    expect(classifyProfitLossAccount(row("5300", "EXPENSE", "Direct costs", 0, 0))).toBe("Direct Expenses");
    expect(classifyProfitLossAccount(row("6100", "EXPENSE", "Operating expenses", 0, 0))).toBe("Indirect Expenses");
    expect(classifyProfitLossAccount(row("7000", "EXPENSE", "Indirect Expenses", 0, 0))).toBe("Tax Expenses");
  });

  it("calculates each subtotal once and derives gross profit and net income", () => {
    const statement = calculateProfitLoss([
      row("4000", "REVENUE", "Revenue", 0, 1000), row("5000", "EXPENSE", "Cost of Goods Sold (COGS)", 400, 0),
      row("5300", "EXPENSE", "Direct Expenses", 100, 0), row("6100", "EXPENSE", "Indirect Expenses", 80, 0),
      row("4300", "REVENUE", "Other Income", 0, 20),
    ]);
    expect(statement.revenue.total.toString()).toBe("1000");
    expect(statement.grossProfit.toString()).toBe("600");
    expect(statement.netIncome.toString()).toBe("440");
  });

  it("keeps indirect classifications out of direct expenses", () => {
    const statement = calculateProfitLoss([
      row("5300", "EXPENSE", "Direct Expenses", 5000, 0),
      row("6000", "EXPENSE", "Indirect Expenses", 17400, 0),
      row("6100", "EXPENSE", "Indirect Expenses", 2000, 0),
    ]);

    expect(statement.directExpenses.rows.map(account => account.code)).toEqual(["5300"]);
    expect(statement.indirectExpenses.rows.map(account => account.code)).toEqual(["6000", "6100"]);
    expect(statement.directExpenses.total.toString()).toBe("5000");
    expect(statement.indirectExpenses.total.toString()).toBe("19400");
  });

  it("separates revenue deductions, operating income, non-operating items, tax, and bottom-line income", () => {
    const statement = calculateProfitLoss([
      row("4000", "REVENUE", "Revenue", 0, 1200),
      row("4050", "REVENUE", "Contra Revenue", 100, 0),
      row("5000", "EXPENSE", "Cost of Goods Sold (COGS)", 400, 0),
      row("5300", "EXPENSE", "Direct Expenses", 50, 0),
      row("6100", "EXPENSE", "Indirect Expenses", 150, 0),
      row("4300", "REVENUE", "Other Income", 0, 25),
      row("6910", "EXPENSE", "Other Expenses", 10, 0),
      row("7000", "EXPENSE", "Tax Expenses", 30, 0),
    ]);

    expect(statement.netRevenue.toString()).toBe("1100");
    expect(statement.grossProfit.toString()).toBe("700");
    expect(statement.operatingExpenses.toString()).toBe("200");
    expect(statement.operatingIncome.toString()).toBe("500");
    expect(statement.incomeBeforeTax.toString()).toBe("515");
    expect(statement.netIncome.toString()).toBe("485");
  });
});
