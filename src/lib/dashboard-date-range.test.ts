import { describe, expect, it } from "vitest";
import { dashboardDateRange } from "./dashboard-date-range";

describe("dashboard date range", () => {
  const decemberYearEnd = { financialYearEndMonth: 12, financialYearEndDay: 31 };

  it("defaults to the active company's financial year through today", () => {
    const range = dashboardDateRange({}, decemberYearEnd, new Date("2026-09-02T09:30:00.000Z"));
    expect(range.fromInput).toBe("2026-01-01");
    expect(range.toInput).toBe("2026-09-02");
  });

  it("supports a March-to-February financial year", () => {
    const range = dashboardDateRange({}, { financialYearEndMonth: 2, financialYearEndDay: 28 }, new Date("2026-09-02T09:30:00.000Z"));
    expect(range.fromInput).toBe("2026-03-01");
  });

  it("accepts valid dates and includes the complete To date", () => {
    const range = dashboardDateRange({ from: "2026-06-10", to: "2026-07-15" }, decemberYearEnd);
    expect(range.from.toISOString()).toBe("2026-06-10T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-07-15T23:59:59.999Z");
  });

  it("allows users to select dates outside the current financial year", () => {
    const range = dashboardDateRange({ from: "2020-01-01", to: "2026-09-02" }, decemberYearEnd);
    expect(range.fromInput).toBe("2020-01-01");
  });
});
