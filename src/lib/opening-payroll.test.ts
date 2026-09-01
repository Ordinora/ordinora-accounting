import { describe, expect, it } from "vitest";
import { assertOpeningPayrollRole, prepareOpeningPayrollYtd, type OpeningPayrollInput } from "./opening-payroll";

const input = (overrides: Partial<OpeningPayrollInput> = {}): OpeningPayrollInput => ({
  employeeId: "employee-1", basicPay: "10000", overtime: "500", allowances: "250", bonuses: "100", leavePayout: "0", gratuity: "0", otherEarnings: "50", otherDeductions: "200", employeeSpk: "350", employerSpk: "400", ...overrides,
});

describe("opening payroll YTD", () => {
  it("calculates gross and net figures from the regular payslip field set", () => {
    const result = prepareOpeningPayrollYtd(input());
    expect(result.grossPay).toBe(1090000n);
    expect(result.netPay).toBe(1035000n);
  });

  it("rejects negative figures and deductions above gross pay", () => {
    expect(() => prepareOpeningPayrollYtd(input({ overtime: "-1" }))).toThrow(/cannot be negative/);
    expect(() => prepareOpeningPayrollYtd(input({ employeeSpk: "12000" }))).toThrow(/cannot exceed/);
  });

  it("rejects a duplicate employee opening record", () => {
    expect(() => prepareOpeningPayrollYtd(input(), ["employee-1"])).toThrow(/already exist/);
  });

  it("allows only opening-balance accounting roles", () => {
    expect(() => assertOpeningPayrollRole("SYSTEM_ADMIN")).not.toThrow();
    expect(() => assertOpeningPayrollRole("FIRM_ADMIN")).not.toThrow();
    expect(() => assertOpeningPayrollRole("ACCOUNTANT")).not.toThrow();
    expect(() => assertOpeningPayrollRole("PAYROLL_OFFICER")).toThrow(/cannot enter/);
    expect(() => assertOpeningPayrollRole("READ_ONLY")).toThrow(/cannot enter/);
  });
});
