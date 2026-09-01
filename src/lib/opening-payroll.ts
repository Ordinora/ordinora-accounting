import { parseMoneyToMinor } from "./accounting";

export const openingPayrollFields = ["basicPay", "overtime", "allowances", "bonuses", "leavePayout", "gratuity", "otherEarnings", "otherDeductions", "employeeSpk", "employerSpk"] as const;
export type OpeningPayrollField = (typeof openingPayrollFields)[number];
export type OpeningPayrollInput = { employeeId: string } & Record<OpeningPayrollField, string>;

export function assertOpeningPayrollRole(role: string | null | undefined) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot enter opening payroll YTD figures.");
}

export function prepareOpeningPayrollYtd(input: OpeningPayrollInput, existingEmployeeIds: readonly string[] = []) {
  if (!input.employeeId) throw new Error("Select an employee.");
  if (existingEmployeeIds.includes(input.employeeId)) throw new Error("Opening payroll YTD figures already exist for this employee.");
  if (openingPayrollFields.some((field) => input[field]?.trim().startsWith("-"))) throw new Error("Opening payroll YTD amounts cannot be negative.");
  const amounts = Object.fromEntries(openingPayrollFields.map((field) => [field, parseMoneyToMinor(input[field] || "0")])) as Record<OpeningPayrollField, bigint>;
  if (openingPayrollFields.some((field) => amounts[field] < 0n)) throw new Error("Opening payroll YTD amounts cannot be negative.");
  const grossPay = amounts.basicPay + amounts.overtime + amounts.allowances + amounts.bonuses + amounts.leavePayout + amounts.gratuity + amounts.otherEarnings;
  if (grossPay <= 0n) throw new Error("Opening YTD gross pay must be greater than zero.");
  const netPay = grossPay - amounts.employeeSpk - amounts.otherDeductions;
  if (netPay < 0n) throw new Error("Employee contributions and other deductions cannot exceed YTD gross pay.");
  return { employeeId: input.employeeId, amounts, grossPay, netPay };
}
