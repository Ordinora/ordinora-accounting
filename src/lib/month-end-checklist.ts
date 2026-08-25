export const MONTH_END_CHECKLIST = [
  { key: "INVENTORY_COUNT", label: "Physical inventory count reviewed", guidance: "Confirm count differences, write-offs, and closing inventory valuation have been reviewed." },
  { key: "DEPRECIATION", label: "Depreciation posted", guidance: "Confirm the fixed-asset register is current and depreciation has been posted through period end." },
  { key: "PAYROLL_LIABILITIES", label: "Payroll liabilities reviewed", guidance: "Reconcile net pay, employee deductions, and employer/statutory contribution liabilities." },
  { key: "ACCRUALS", label: "Accruals and unpaid expenses reviewed", guidance: "Record material expenses incurred but not yet billed or paid." },
  { key: "PREPAYMENTS", label: "Prepayments and deferrals reviewed", guidance: "Release the period portion of prepaid expenses and defer amounts belonging to future periods." },
  { key: "MANAGEMENT_REVIEW", label: "Management accounts reviewed", guidance: "Review unusual balances, margins, comparative movements, and obtain the appropriate approval." },
] as const;

export type MonthEndChecklistKey = (typeof MONTH_END_CHECKLIST)[number]["key"];

export function monthEndChecklistDefinition(key: string) {
  return MONTH_END_CHECKLIST.find((item) => item.key === key);
}
