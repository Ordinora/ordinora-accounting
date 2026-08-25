import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { calculateSettlementValues, convertForeignToBase, normalizeCurrencyCode, realizedFxPosting, validateExchangeRate } from "./currency";

describe("currency accounting", () => {
  it("normalizes ISO-style codes", () => expect(normalizeCurrencyCode(" usd ")).toBe("USD"));
  it("rejects zero and negative rates", () => {
    expect(() => validateExchangeRate("0")).toThrow();
    expect(() => validateExchangeRate("-1")).toThrow();
  });
  it("converts and rounds only at the base-currency boundary", () => {
    expect(convertForeignToBase(new Prisma.Decimal("100.25"), new Prisma.Decimal("1.34215")).toFixed(2)).toBe("134.55");
  });
  it("preserves carrying value and identifies a realized exchange difference", () => {
    const result=calculateSettlementValues(new Prisma.Decimal("100"),new Prisma.Decimal("1.30"),new Prisma.Decimal("1.35"));
    expect(result.carryingBase.toFixed(2)).toBe("130.00");expect(result.settlementBase.toFixed(2)).toBe("135.00");expect(result.difference.toFixed(2)).toBe("5.00");
  });
  it("calculates a realized gain when a foreign customer settles at a weaker rate", () => {
    const result=calculateSettlementValues(new Prisma.Decimal("1000"),new Prisma.Decimal("1.35"),new Prisma.Decimal("1.30"));
    expect(result.carryingBase.toFixed(2)).toBe("1350.00");
    expect(result.settlementBase.toFixed(2)).toBe("1300.00");
    expect(result.difference.toFixed(2)).toBe("-50.00");
  });
  it("allocates partial foreign settlements at the document carrying rate", () => {
    const first=calculateSettlementValues(new Prisma.Decimal("400"),new Prisma.Decimal("1.25"),new Prisma.Decimal("1.30"));
    const second=calculateSettlementValues(new Prisma.Decimal("600"),new Prisma.Decimal("1.25"),new Prisma.Decimal("1.20"));
    expect(first.carryingBase.add(second.carryingBase).toFixed(2)).toBe("1250.00");
    expect(first.difference.add(second.difference).toFixed(2)).toBe("-10.00");
  });
  it("rounds zero-decimal and three-decimal currencies at their configured boundary", () => {
    expect(convertForeignToBase(new Prisma.Decimal("100"),new Prisma.Decimal("0.0091"),0).toString()).toBe("1");
    expect(convertForeignToBase(new Prisma.Decimal("10.555"),new Prisma.Decimal("1.3333"),3).toString()).toBe("14.073");
  });
  it("posts customer exchange gains and losses to the correct side", () => {
    expect(realizedFxPosting("RECEIPT",new Prisma.Decimal("50")).credit.toFixed(2)).toBe("50.00");
    expect(realizedFxPosting("RECEIPT",new Prisma.Decimal("-50")).debit.toFixed(2)).toBe("50.00");
  });
  it("posts supplier exchange gains and losses to the correct side", () => {
    expect(realizedFxPosting("PAYMENT",new Prisma.Decimal("50")).debit.toFixed(2)).toBe("50.00");
    expect(realizedFxPosting("PAYMENT",new Prisma.Decimal("-50")).credit.toFixed(2)).toBe("50.00");
  });
});
