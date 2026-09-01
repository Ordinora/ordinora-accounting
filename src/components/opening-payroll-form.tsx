"use client";

import { useActionState } from "react";
import { createOpeningPayrollYtd, type OpeningPayrollState } from "@/app/settings/opening-payroll/actions";

type EmployeeOption = { id: string; employeeNumber: string; fullName: string };
const fields = [
  ["basicPay", "Basic pay"], ["overtime", "Overtime"], ["allowances", "Allowances"], ["bonuses", "Bonuses"],
  ["leavePayout", "Unused leave payout"], ["gratuity", "Gratuity / severance"], ["otherEarnings", "Other earnings"],
  ["employeeSpk", "Employee SPK/TAP"], ["employerSpk", "Employer SPK/TAP"], ["otherDeductions", "Other deductions"],
] as const;

export function OpeningPayrollForm({ employees, conversionDate }: { employees: EmployeeOption[]; conversionDate: string }) {
  const [state, action, pending] = useActionState<OpeningPayrollState, FormData>(createOpeningPayrollYtd, {});
  return <form action={action} className="surface-card form-panel">
    <section className="form-section">
      <div className="section-heading"><h2>Add employee opening YTD</h2><p>Reporting-only totals as at {conversionDate}. This creates no payroll run, payable, or general-ledger posting.</p></div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <div className="form-grid">
        <label className="full-span">Employee<select name="employeeId" required defaultValue=""><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employeeNumber} — {employee.fullName}</option>)}</select></label>
        {fields.map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0" step="0.01" defaultValue="0" required /></label>)}
      </div>
    </section>
    <div className="form-actions"><button className="button-primary" disabled={pending || !employees.length}>{pending ? "Saving YTD figures…" : "Save opening YTD"}</button></div>
  </form>;
}
