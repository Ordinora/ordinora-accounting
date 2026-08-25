import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { allocateCashFlowByActivity, classifyCashCounterpart } from "./cash-flow";

describe("cash-flow classification", () => {
  it("classifies income and normal working-capital accounts as operating", () => {
    expect(classifyCashCounterpart({ code: "4000", type: "REVENUE", reportingClassification: "Sales" })).toBe("OPERATING");
    expect(classifyCashCounterpart({ code: "2000", type: "LIABILITY", reportingClassification: "Trade payables" })).toBe("OPERATING");
    expect(classifyCashCounterpart({ code: "1200", type: "ASSET", reportingClassification: "Current assets" })).toBe("OPERATING");
  });
  it("classifies fixed assets as investing and loans/equity as financing", () => {
    expect(classifyCashCounterpart({ code: "1520", type: "ASSET", reportingClassification: "Property plant and equipment" })).toBe("INVESTING");
    expect(classifyCashCounterpart({ code: "2300", type: "LIABILITY", reportingClassification: "Borrowings" })).toBe("FINANCING");
    expect(classifyCashCounterpart({ code: "3000", type: "EQUITY", reportingClassification: "Capital" })).toBe("FINANCING");
  });

  it("splits a mixed cash payment between operating and investing activities", () => {
    const result = allocateCashFlowByActivity([
      { debit: new Prisma.Decimal(300), credit: new Prisma.Decimal(0), account: { code: "6100", type: "EXPENSE", reportingClassification: "Operating expenses" } },
      { debit: new Prisma.Decimal(700), credit: new Prisma.Decimal(0), account: { code: "1500", type: "ASSET", reportingClassification: "Property plant and equipment" } },
    ]);
    expect(result.OPERATING.toFixed(2)).toBe("-300.00");
    expect(result.INVESTING.toFixed(2)).toBe("-700.00");
    expect(result.FINANCING.toFixed(2)).toBe("0.00");
  });

  it("splits a mixed receipt between operating and financing activities", () => {
    const result = allocateCashFlowByActivity([
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(800), account: { code: "4000", type: "REVENUE", reportingClassification: "Sales" } },
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(200), account: { code: "2300", type: "LIABILITY", reportingClassification: "Borrowings" } },
    ]);
    expect(result.OPERATING.toFixed(2)).toBe("800.00");
    expect(result.FINANCING.toFixed(2)).toBe("200.00");
  });
});
