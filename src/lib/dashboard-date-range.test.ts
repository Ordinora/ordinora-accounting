import { describe, expect, it } from "vitest";
import { dashboardDateRange } from "./dashboard-date-range";

describe("dashboard date range", () => {
  it("defaults to a six-month window ending today", () => {
    const range = dashboardDateRange({}, new Date("2026-09-02T09:30:00.000Z"));
    expect(range.fromInput).toBe("2026-04-01");
    expect(range.toInput).toBe("2026-09-02");
  });

  it("accepts valid dates and includes the complete To date", () => {
    const range = dashboardDateRange({ from: "2026-06-10", to: "2026-07-15" });
    expect(range.from.toISOString()).toBe("2026-06-10T00:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-07-15T23:59:59.999Z");
  });

  it("caps dashboard queries to twelve months", () => {
    const range = dashboardDateRange({ from: "2020-01-01", to: "2026-09-02" });
    expect(range.fromInput).toBe("2025-10-01");
  });
});
