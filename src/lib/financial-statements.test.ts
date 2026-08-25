import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateBalanceSheet, type LedgerBalanceRow } from "./financial-statements";

const row = (id: string, type: string, debit: number, credit: number): LedgerBalanceRow => ({ id, code: id, name: id, type, classification: type, debit: new Prisma.Decimal(debit), credit: new Prisma.Decimal(credit), balance: new Prisma.Decimal(debit).sub(credit) });

describe("calculateBalanceSheet", () => {
  it("presents assets equal to liabilities plus equity including current earnings", () => {
    const statement = calculateBalanceSheet([row("cash", "ASSET", 100, 0), row("loan", "LIABILITY", 0, 30), row("capital", "EQUITY", 0, 50), row("sales", "REVENUE", 0, 30), row("expense", "EXPENSE", 10, 0)]);
    expect(statement.totalAssets.toNumber()).toBe(100);
    expect(statement.totalLiabilitiesAndEquity.toNumber()).toBe(100);
    expect(statement.difference.toNumber()).toBe(0);
    expect(statement.potentialDuplicateCurrentEarnings).toBe(false);
  });

  it("flags a current-year earnings equity balance while profit-and-loss accounts remain open", () => {
    const statement = calculateBalanceSheet([
      row("cash", "ASSET", 120, 0), row("capital", "EQUITY", 0, 80),
      { ...row("current", "EQUITY", 0, 20), code: "3200", name: "Current-year earnings" },
      row("sales", "REVENUE", 0, 30), row("expense", "EXPENSE", 10, 0),
    ]);
    expect(statement.designatedCurrentEarningsBalance.toFixed(2)).toBe("20.00");
    expect(statement.currentEarnings.toFixed(2)).toBe("20.00");
    expect(statement.potentialDuplicateCurrentEarnings).toBe(true);
  });
});
