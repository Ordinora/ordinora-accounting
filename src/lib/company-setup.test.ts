import { describe, expect, it } from "vitest";
import { monthlyAccountingPeriods } from "./company-setup";
describe("company onboarding", () => {
  it("creates all monthly periods including leap-year February", () => {
    const periods = monthlyAccountingPeriods(2024);
    expect(periods).toHaveLength(12);
    expect(periods[1].name).toBe("February 2024");
    expect(periods[1].endsOn.toISOString().slice(0, 10)).toBe("2024-02-29");
  });

  it("creates periods matching a March-to-February financial year", () => {
    const periods = monthlyAccountingPeriods(2027, { financialYearEndMonth: 2, financialYearEndDay: 28 });
    expect(periods[0].startsOn.toISOString().slice(0, 10)).toBe("2026-03-01");
    expect(periods[11].endsOn.toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});
