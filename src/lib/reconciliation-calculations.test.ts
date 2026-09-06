import { describe, expect, it } from "vitest";
import { calculateReconciliation, parseStatementBalance } from "./reconciliation-calculations";

describe("bank reconciliation calculations", () => {
  const movements = [{ id: "deposit", debit: 500, credit: 0 }, { id: "payment", debit: 0, credit: 120 }, { id: "uncleared", debit: 0, credit: 30 }];
  it("compares the statement with only cleared book movements", () => {
    const result = calculateReconciliation({ openingBalance: 1000, statementClosingBalance: 1380, movements, clearedIds: ["deposit", "payment"] });
    expect(result.clearedBookBalance.toString()).toBe("1380");
    expect(result.difference.toString()).toBe("0");
    expect(result.outstandingMovement.toString()).toBe("-30");
  });
  it("reports a difference when a statement transaction is not cleared", () => {
    const result = calculateReconciliation({ openingBalance: 1000, statementClosingBalance: 1380, movements, clearedIds: ["deposit"] });
    expect(result.difference.toString()).toBe("-120");
  });
  it("accepts positive and overdraft statement balances", () => {
    expect(parseStatementBalance("8,000.25").toString()).toBe("8000.25");
    expect(parseStatementBalance("-650.00").toString()).toBe("-650");
    expect(() => parseStatementBalance("12.345")).toThrow("no more than two decimal places");
  });
});
