import { describe, expect, it } from "vitest";
import { calculateSectionG, type SectionGInput } from "./tax-payable";

const base: SectionGInput = {
  companyCategory: "OTHER",
  rateMode: "STANDARD",
  taxRate: "18.5",
  chargeableIncome: "0",
  foreignIncome: "0",
  doubleTaxRelief: "0",
  tapCredit: "0",
  localEmploymentCredit: "0",
  trainingCredit: "0",
  exportSalesTax: "0",
  taxPaidEci: "0",
  priorYearTaxOffset: "0",
  withholdingTaxPaid: "0",
};

describe("OCP Section G tax payable", () => {
  it("applies the first-three-YOA exemption and threshold bands", () => {
    const result = calculateSectionG({ ...base, companyCategory: "NEWLY_INCORPORATED", chargeableIncome: "450000" });
    expect(result.firstTax.toString()).toBe("0");
    expect(result.nextTax.toString()).toBe("13875");
    expect(result.remainingTax.toString()).toBe("37000");
    expect(result.grossTaxPayable.toString()).toBe("50875");
  });

  it("calculates G5 to G8 for an existing company", () => {
    const result = calculateSectionG({ ...base, chargeableIncome: "450000" });
    expect(result.firstTax.toString()).toBe("4625");
    expect(result.nextTax.toString()).toBe("13875");
    expect(result.remainingTax.toString()).toBe("37000");
    expect(result.grossTaxPayable.toString()).toBe("55500");
  });

  it("flows relief, credits, export tax, and paid amounts through G16", () => {
    const result = calculateSectionG({ ...base, chargeableIncome: "100000", foreignIncome: "5000", doubleTaxRelief: "500", tapCredit: "100", localEmploymentCredit: "200", trainingCredit: "50", exportSalesTax: "300", taxPaidEci: "4000", priorYearTaxOffset: "100", withholdingTaxPaid: "75" });
    expect(result.grossTaxPayable.toString()).toBe("4625");
    expect(result.taxAfterDoubleTaxRelief.toString()).toBe("4125");
    expect(result.totalTaxCredits.toString()).toBe("350");
    expect(result.netTaxPayable.toString()).toBe("4075");
    expect(result.totalTaxAlreadyPaid.toString()).toBe("4175");
    expect(result.balanceTaxPayable.toString()).toBe("-100");
  });

  it("applies the 55% LNG rate directly to all chargeable income", () => {
    const result = calculateSectionG({ ...base, rateMode: "LNG", chargeableIncome: "100000" });
    expect(result.taxRate.toString()).toBe("55");
    expect(result.grossTaxPayable.toString()).toBe("55000");
    expect(result.firstTax.toString()).toBe("0");
  });

  it("requires foreign income before double-taxation relief", () => {
    expect(() => calculateSectionG({ ...base, chargeableIncome: "100000", doubleTaxRelief: "1" })).toThrow("foreign income");
  });
});
