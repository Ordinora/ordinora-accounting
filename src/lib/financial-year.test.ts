import { describe, expect, it } from "vitest";
import { currentFinancialYearEnd, currentFinancialYearStart, financialYearDateRange, validFinancialYearEnd } from "./financial-year";

describe("company financial year", () => {
  it.each([
    [{ financialYearEndMonth: 12, financialYearEndDay: 31 }, "2026-01-01"],
    [{ financialYearEndMonth: 2, financialYearEndDay: 28 }, "2026-03-01"],
    [{ financialYearEndMonth: 4, financialYearEndDay: 30 }, "2026-05-01"],
  ])("calculates the current year start", (settings, expected) => {
    expect(currentFinancialYearStart(settings, new Date("2026-09-06T12:00:00.000Z")).toISOString().slice(0, 10)).toBe(expected);
  });

  it("uses the financial year containing a historical selected To date", () => {
    const range = financialYearDateRange({ to: "2026-01-20" }, { financialYearEndMonth: 2, financialYearEndDay: 28 });
    expect(range.fromInput).toBe("2025-03-01");
  });

  it("calculates an October financial year end before and after the cutoff", () => {
    const settings = { financialYearEndMonth: 10, financialYearEndDay: 31 };
    expect(currentFinancialYearEnd(settings, new Date("2026-09-07T12:00:00.000Z")).toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(currentFinancialYearEnd(settings, new Date("2026-11-01T12:00:00.000Z")).toISOString().slice(0, 10)).toBe("2027-10-31");
  });

  it("validates real month and day combinations", () => {
    expect(validFinancialYearEnd(2, 29)).toBe(true);
    expect(validFinancialYearEnd(2, 30)).toBe(false);
    expect(validFinancialYearEnd(4, 31)).toBe(false);
  });
});
