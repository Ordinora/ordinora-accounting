import { describe, expect, it } from "vitest";
import { calculateCommercialAmounts } from "./commercial-calculations";

const lines = [
  { description: "Inventory A", accountId: "inventory", quantity: "2", unitPrice: "100", discountPercent: "10" },
  { description: "Inventory B", accountId: "inventory", quantity: "1", unitPrice: "70", discountPercent: "0" },
];

describe("commercial document discounts", () => {
  it("applies a fixed discount proportionally after line discounts", () => {
    const result = calculateCommercialAmounts(lines, "AMOUNT", "50");
    expect(result.foreignSubtotal.toString()).toBe("250");
    expect(result.discountAmount.toString()).toBe("50");
    expect(result.foreignTotal.toString()).toBe("200");
    expect(result.lines.reduce((sum, line) => sum + Number(line.foreign), 0)).toBe(200);
  });

  it("applies a percentage discount after line discounts", () => {
    const result = calculateCommercialAmounts(lines, "PERCENT", "5");
    expect(result.discountAmount.toString()).toBe("12.5");
    expect(result.foreignTotal.toString()).toBe("237.5");
  });

  it("rejects a discount that removes the complete document value", () => {
    expect(() => calculateCommercialAmounts(lines, "AMOUNT", "250")).toThrow("less than the subtotal");
  });
});
