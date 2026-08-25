import { describe, expect, it } from "vitest";
import { corporateTaxReturnDueDate, estimatedChargeableIncomeDueDate, taxPeriodsOverlap } from "./tax-deadlines";

const iso = (value: Date) => value.toISOString().slice(0, 10);

describe("Brunei corporate-tax workflow deadlines", () => {
  it("sets the annual return deadline to 30 June of the year of assessment", () => {
    expect(iso(corporateTaxReturnDueDate(2026))).toBe("2026-06-30");
  });

  it("sets ECI three calendar months after accounting-period end", () => {
    expect(iso(estimatedChargeableIncomeDueDate(new Date("2026-12-31T00:00:00Z")))).toBe("2027-03-31");
    expect(iso(estimatedChargeableIncomeDueDate(new Date("2026-11-30T00:00:00Z")))).toBe("2027-02-28");
    expect(iso(estimatedChargeableIncomeDueDate(new Date("2027-11-30T00:00:00Z")))).toBe("2028-02-29");
  });

  it("detects overlapping periods including shared boundary dates", () => {
    const first = { startsOn: new Date("2026-01-01"), endsOn: new Date("2026-12-31") };
    expect(taxPeriodsOverlap(first, { startsOn: new Date("2026-12-31"), endsOn: new Date("2027-12-30") })).toBe(true);
    expect(taxPeriodsOverlap(first, { startsOn: new Date("2027-01-01"), endsOn: new Date("2027-12-31") })).toBe(false);
  });
});
