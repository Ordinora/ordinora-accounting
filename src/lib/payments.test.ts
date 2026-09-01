import { describe, expect, it } from "vitest";
import { calculatePaymentAmounts, calculatePaymentLines } from "./payment-calculations";

describe("payment calculations", () => {
  it("calculates multiple lines with accounting rounding", () => {
    const lines = calculatePaymentLines([{ accountId: "expense-1", description: "Stationery", quantity: "3", unitPrice: "2.13" }, { accountId: "asset-1", description: "Equipment", quantity: "1", unitPrice: "100" }]);
    expect(lines[0].foreignAmount.toString()).toBe("6.39");
    expect(lines[1].foreignAmount.toString()).toBe("100");
  });
  it("rejects zero-value lines", () => expect(() => calculatePaymentLines([{ accountId: "expense-1", description: "Invalid", quantity: "1", unitPrice: "0" }])).toThrow("positive amount"));
  it("allocates a percentage payment discount across lines", () => {
    const result = calculatePaymentAmounts([{ accountId: "inventory-1", description: "Stock", quantity: "2", unitPrice: "100" }, { accountId: "expense-1", description: "Delivery", quantity: "1", unitPrice: "50" }], "PERCENT", "10");
    expect(result.foreignSubtotal.toString()).toBe("250");
    expect(result.discountAmount.toString()).toBe("25");
    expect(result.foreignTotal.toString()).toBe("225");
    expect(result.lines.map((line) => line.foreignAmount.toString())).toEqual(["180", "45"]);
  });
  it("applies a fixed payment discount with exact rounding allocation", () => {
    const result = calculatePaymentAmounts([{ accountId: "one", description: "One", quantity: "1", unitPrice: "10" }, { accountId: "two", description: "Two", quantity: "1", unitPrice: "20" }], "AMOUNT", "5");
    expect(result.lines.reduce((sum, line) => sum.add(line.documentDiscountAmount), result.discountAmount.mul(0)).toString()).toBe("5");
    expect(result.foreignTotal.toString()).toBe("25");
  });
});
