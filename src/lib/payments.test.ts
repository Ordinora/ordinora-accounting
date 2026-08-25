import { describe, expect, it } from "vitest";
import { calculatePaymentLines } from "./payment-calculations";

describe("payment calculations", () => {
  it("calculates multiple lines with accounting rounding", () => {
    const lines = calculatePaymentLines([{ accountId: "expense-1", description: "Stationery", quantity: "3", unitPrice: "2.13" }, { accountId: "asset-1", description: "Equipment", quantity: "1", unitPrice: "100" }]);
    expect(lines[0].foreignAmount.toString()).toBe("6.39");
    expect(lines[1].foreignAmount.toString()).toBe("100");
  });
  it("rejects zero-value lines", () => expect(() => calculatePaymentLines([{ accountId: "expense-1", description: "Invalid", quantity: "1", unitPrice: "0" }])).toThrow("positive amount"));
});
