import { describe, expect, it } from "vitest";
import { canAccessModule, isSystemAdministrator } from "./staff-access";

describe("staff access policy", () => {
  it("allows accountants to perform payroll work but not administration", () => {
    expect(canAccessModule("ACCOUNTANT", "payroll")).toBe(true);
    expect(canAccessModule("ACCOUNTANT", "administration")).toBe(false);
  });

  it("keeps security administration exclusive to the system administrator", () => {
    expect(isSystemAdministrator("SYSTEM ADMIN")).toBe(true);
    expect(isSystemAdministrator("FIRM_ADMIN")).toBe(false);
    expect(isSystemAdministrator("ACCOUNTANT")).toBe(false);
  });

  it("limits payroll officers and read-only staff to their assigned functions", () => {
    expect(canAccessModule("PAYROLL_OFFICER", "payroll")).toBe(true);
    expect(canAccessModule("PAYROLL_OFFICER", "sales")).toBe(false);
    expect(canAccessModule("READ_ONLY", "reports")).toBe(true);
    expect(canAccessModule("READ_ONLY", "accounting")).toBe(false);
  });
});
