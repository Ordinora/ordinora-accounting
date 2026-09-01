import { describe, expect, it } from "vitest";
import { parseCommercialDiscount } from "./commercial-discount";

describe("commercial document discount input", () => {
  it("recognizes percentages", () => expect(parseCommercialDiscount("5%")).toEqual({ discountType: "PERCENT", discountValue: "5" }));
  it("recognizes plain and currency-prefixed fixed amounts", () => {
    expect(parseCommercialDiscount("100")).toEqual({ discountType: "AMOUNT", discountValue: "100" });
    expect(parseCommercialDiscount("$100.00")).toEqual({ discountType: "AMOUNT", discountValue: "100.00" });
  });
  it("treats blank and zero as no discount", () => {
    expect(parseCommercialDiscount("")).toEqual({ discountType: "NONE", discountValue: "0" });
    expect(parseCommercialDiscount("0.00")).toEqual({ discountType: "NONE", discountValue: "0" });
  });
  it("rejects invalid or excessive values", () => {
    expect(() => parseCommercialDiscount("101%")).toThrow(/maximum 100%/);
    expect(() => parseCommercialDiscount("five")).toThrow(/fixed amount or percentage/);
  });
});
