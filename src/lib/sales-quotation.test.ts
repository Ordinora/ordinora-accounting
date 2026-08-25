import { describe, expect, it } from "vitest";
import { assertQuotationTransition, calculateQuotationLines } from "./sales-quotation";

describe("sales quotation rules", () => {
  it("calculates discounted quotation lines with accounting precision", () => {
    const [line] = calculateQuotationLines([{ description: "Service", accountId: "revenue", quantity: "2", unitPrice: "125.50", discountPercent: "10" }]);
    expect(line.discountAmount.toString()).toBe("25.1");
    expect(line.lineTotal.toString()).toBe("225.9");
  });

  it("permits the controlled quote lifecycle", () => {
    expect(() => assertQuotationTransition("DRAFT", "SENT")).not.toThrow();
    expect(() => assertQuotationTransition("SENT", "ACCEPTED")).not.toThrow();
    expect(() => assertQuotationTransition("ACCEPTED", "CONVERTED")).not.toThrow();
  });

  it("rejects duplicate or backward conversion paths", () => {
    expect(() => assertQuotationTransition("DRAFT", "ACCEPTED")).toThrow("cannot be changed");
    expect(() => assertQuotationTransition("CONVERTED", "ACCEPTED")).toThrow("cannot be changed");
  });

  it("rejects invalid prices, quantities, and discounts", () => {
    expect(() => calculateQuotationLines([{ description: "Bad", accountId: "revenue", quantity: "0", unitPrice: "10" }])).toThrow("Quantities");
    expect(() => calculateQuotationLines([{ description: "Bad", accountId: "revenue", quantity: "1", unitPrice: "10", discountPercent: "101" }])).toThrow("Discount");
  });
});
