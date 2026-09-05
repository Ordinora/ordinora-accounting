import { describe, expect, it } from "vitest";
import { bankingDateRange, calculateBankLedger } from "./banking-calculations";

describe("bank ledger calculations", () => {
  it("calculates debit-positive running balances in date order", () => {
    const result = calculateBankLedger([
      { id: "b", debit: 0, credit: 25, accountingDate: new Date("2026-01-02") },
      { id: "a", debit: 100, credit: 0, accountingDate: new Date("2026-01-01") },
    ]);
    expect(result.rows.map((row) => row.runningBalance.toString())).toEqual(["100", "75"]);
    expect(result.balance.toString()).toBe("75");
  });

  it("returns separate debit and credit totals", () => {
    const result = calculateBankLedger([
      { id: "a", debit: "250.50", credit: 0, accountingDate: new Date("2026-02-01") },
      { id: "b", debit: 0, credit: "80.25", accountingDate: new Date("2026-02-02") },
    ]);
    expect(result.totalDebits.toString()).toBe("250.5");
    expect(result.totalCredits.toString()).toBe("80.25");
  });

  it("carries earlier movements into the opening and period running balances", () => {
    const result = calculateBankLedger([
      { id: "opening", debit: 100, credit: 0, accountingDate: new Date("2026-01-15T00:00:00.000Z") },
      { id: "debit", debit: 40, credit: 0, accountingDate: new Date("2026-02-10T00:00:00.000Z") },
      { id: "credit", debit: 0, credit: 25, accountingDate: new Date("2026-02-20T00:00:00.000Z") },
      { id: "future", debit: 500, credit: 0, accountingDate: new Date("2026-03-01T00:00:00.000Z") },
    ], {
      from: new Date("2026-02-01T00:00:00.000Z"),
      to: new Date("2026-02-28T23:59:59.999Z"),
    });

    expect(result.openingBalance.toString()).toBe("100");
    expect(result.totalDebits.toString()).toBe("40");
    expect(result.totalCredits.toString()).toBe("25");
    expect(result.rows.map((row) => row.runningBalance.toString())).toEqual(["140", "115"]);
    expect(result.balance.toString()).toBe("115");
  });
});

describe("banking date range", () => {
  it("defaults to six calendar months ending today", () => {
    const range = bankingDateRange({}, new Date("2026-09-05T10:00:00.000Z"));
    expect(range.fromInput).toBe("2026-04-01");
    expect(range.toInput).toBe("2026-09-05");
  });

  it("accepts ranges longer than twelve months for account statements", () => {
    const range = bankingDateRange({ from: "2024-01-01", to: "2026-09-05" });
    expect(range.fromInput).toBe("2024-01-01");
    expect(range.to.toISOString()).toBe("2026-09-05T23:59:59.999Z");
  });

  it("normalizes an inverted range to the selected To date", () => {
    const range = bankingDateRange({ from: "2026-09-10", to: "2026-09-05" });
    expect(range.fromInput).toBe("2026-09-05");
    expect(range.toInput).toBe("2026-09-05");
  });
});
