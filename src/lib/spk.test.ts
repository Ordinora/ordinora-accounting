import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateSpk } from "./spk";

const decimal = (value: string) => new Prisma.Decimal(value);
const configuredBands = [
  { salaryFrom: decimal("0"), salaryTo: decimal("500"), employeeRatePercent: decimal("8.5"), employerRatePercent: null, employerFixedAmount: decimal("57.50"), minimumEmployerAmount: null },
  { salaryFrom: decimal("500.01"), salaryTo: decimal("1500"), employeeRatePercent: decimal("8.5"), employerRatePercent: decimal("10.5"), employerFixedAmount: null, minimumEmployerAmount: decimal("57.50") },
  { salaryFrom: decimal("1500.01"), salaryTo: decimal("2800"), employeeRatePercent: decimal("8.5"), employerRatePercent: decimal("9.5"), employerFixedAmount: null, minimumEmployerAmount: null },
  { salaryFrom: decimal("2800.01"), salaryTo: null, employeeRatePercent: decimal("8.5"), employerRatePercent: decimal("8.5"), employerFixedAmount: null, minimumEmployerAmount: null },
];

describe("SPK contribution calculation", () => {
  it("uses the fixed employer contribution for salaries up to BND 500", () => {
    const result = calculateSpk(decimal("500"), configuredBands);
    expect(result.employee.toFixed(2)).toBe("42.50");
    expect(result.employer.toFixed(2)).toBe("57.50");
  });

  it("selects the effective salary band and rounds to cents", () => {
    const result = calculateSpk(decimal("2000"), configuredBands);
    expect(result.employee.toFixed(2)).toBe("170.00");
    expect(result.employer.toFixed(2)).toBe("190.00");
  });

  it.each([
    ["0", "0.00", "57.50"], ["500.01", "42.50", "57.50"], ["1500", "127.50", "157.50"],
    ["1500.01", "127.50", "142.50"], ["2800", "238.00", "266.00"], ["2800.01", "238.00", "238.00"],
    ["10000", "850.00", "850.00"],
  ])("calculates the configured boundary for BND %s", (salary, employee, employer) => {
    const result = calculateSpk(decimal(salary), configuredBands);
    expect(result.employee.toFixed(2)).toBe(employee);
    expect(result.employer.toFixed(2)).toBe(employer);
  });

  it("rounds each contribution independently to two decimal places", () => {
    const result = calculateSpk(decimal("1234.56"), configuredBands);
    expect(result.employee.toFixed(2)).toBe("104.94");
    expect(result.employer.toFixed(2)).toBe("129.63");
  });

  it("rejects a negative salary base", () => {
    expect(() => calculateSpk(decimal("-1"), configuredBands)).toThrow("cannot be negative");
  });

  it("rejects overlapping effective bands", () => {
    const overlapping = [...configuredBands, { ...configuredBands[0], salaryFrom: decimal("400"), salaryTo: decimal("600") }];
    expect(() => calculateSpk(decimal("450"), overlapping)).toThrow("More than one effective SPK rate band");
  });

  it("rejects an uncovered salary", () => {
    expect(() => calculateSpk(decimal("500.005"), configuredBands)).toThrow("No effective SPK rate band");
  });
});
