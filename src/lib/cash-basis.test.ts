import { describe, expect, it } from "vitest";
import { allocatedCashExpense } from "./cash-basis-calculations";
describe("cash-basis expense recognition", () => {
  it("recognises only the expense portion of a mixed supplier bill", () => expect(allocatedCashExpense([{ settlementBaseAmount: 500, billForeignTotal: 1000, expenseForeignTotal: 300 }])).toBe(150));
  it("does not treat an asset-only supplier payment as an expense", () => expect(allocatedCashExpense([{ settlementBaseAmount: 6500, billForeignTotal: 6500, expenseForeignTotal: 0 }])).toBe(0));
  it("caps the recognised expense at the settlement amount", () => expect(allocatedCashExpense([{ settlementBaseAmount: 100, billForeignTotal: 50, expenseForeignTotal: 70 }])).toBe(100));
});
