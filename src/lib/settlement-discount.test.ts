import { describe, expect, it } from "vitest";
import { calculateSupplierSettlement, parseSettlementDiscount } from "./settlement-discount";

describe("supplier settlement discounts", () => {
  it("calculates percentage discounts against the outstanding balance", () => {
    expect(parseSettlementDiscount("5%", 1_000_000n).amountMinor).toBe(50_000n);
    expect(parseSettlementDiscount("2.5 %", 1_000_000n).amountMinor).toBe(25_000n);
  });

  it("accepts fixed discounts", () => {
    expect(parseSettlementDiscount("500", 1_000_000n).amountMinor).toBe(50_000n);
    expect(parseSettlementDiscount("125.75", 1_000_000n).amountMinor).toBe(12_575n);
  });

  it("calculates full and partial settlement", () => {
    expect(calculateSupplierSettlement({ outstandingMinor: 1_000_000n, cashInput: "9500", discountInput: "5%" })).toMatchObject({ totalSettledMinor: 1_000_000n, remainingMinor: 0n, posting: { payableDebitMinor: 1_000_000n, bankCreditMinor: 950_000n, purchaseDiscountCreditMinor: 50_000n } });
    expect(calculateSupplierSettlement({ outstandingMinor: 1_000_000n, cashInput: "4000", discountInput: "2%" })).toMatchObject({ cashMinor: 400_000n, discountMinor: 20_000n, totalSettledMinor: 420_000n, remainingMinor: 580_000n });
  });

  it.each(["abc", "%%", "-5", "101%"])("rejects invalid input %s", (value) => {
    expect(() => parseSettlementDiscount(value, 1_000_000n)).toThrow();
  });

  it("rejects a settlement greater than outstanding", () => {
    expect(() => calculateSupplierSettlement({ outstandingMinor: 1_000_000n, cashInput: "9800", discountInput: "500" })).toThrow("cannot exceed");
  });
});
