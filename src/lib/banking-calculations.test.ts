import { describe, expect, it } from "vitest";
import { calculateBankLedger } from "./banking-calculations";

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
});
