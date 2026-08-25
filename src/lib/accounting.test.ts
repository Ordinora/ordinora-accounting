import { describe, expect, it } from "vitest";
import { AccountingRuleError, assertJournalMutable, assertPeriodAllowsPosting, formatBnd, parseMoneyToMinor, validateBalancedPosting } from "./accounting";

describe("accounting invariants", () => {
  it("accepts an exactly balanced posting", () => {
    expect(validateBalancedPosting([
      { accountId: "receivables", debitMinor: 12550n, creditMinor: 0n },
      { accountId: "revenue", debitMinor: 0n, creditMinor: 12550n },
    ])).toEqual({ debitsMinor: 12550n, creditsMinor: 12550n });
  });
  it("rejects unbalanced and ambiguous lines", () => {
    expect(() => validateBalancedPosting([
      { accountId: "cash", debitMinor: 100n, creditMinor: 0n },
      { accountId: "revenue", debitMinor: 0n, creditMinor: 99n },
    ])).toThrow(AccountingRuleError);
    expect(() => validateBalancedPosting([
      { accountId: "cash", debitMinor: 100n, creditMinor: 1n },
      { accountId: "revenue", debitMinor: 0n, creditMinor: 99n },
    ])).toThrow("exactly one");
  });
  it("enforces period locks and posted immutability", () => {
    expect(() => assertPeriodAllowsPosting("LOCKED")).toThrow("locked");
    expect(() => assertJournalMutable("POSTED")).toThrow("immutable");
  });
  it("formats integer minor units without floating point", () => {
    expect(formatBnd(123456n)).toBe("B$1,234.56");
    expect(formatBnd(-5n)).toBe("-B$0.05");
  });
  it("parses BND input into exact minor units", () => {
    expect(parseMoneyToMinor("1,234.50")).toBe(123450n);
    expect(parseMoneyToMinor("0.05")).toBe(5n);
    expect(() => parseMoneyToMinor("1.005")).toThrow(AccountingRuleError);
    expect(() => parseMoneyToMinor("-2.00")).toThrow(AccountingRuleError);
  });
});
