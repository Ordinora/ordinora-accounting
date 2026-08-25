"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createPayrollRun, type PayrollRunActionState } from "@/app/payroll/actions";
import { AutoReferenceField } from "@/components/auto-reference-field";

type Employee = { id: string; employeeNumber: string; fullName: string; basicSalary: string };
export function PayrollRunForm({ employees }: { employees: Employee[] }) {
  const [state, action, pending] = useActionState<PayrollRunActionState, FormData>(createPayrollRun, {});

  if (!employees.length) return <section className="surface-card table-empty">Add at least one active employee before preparing payroll.</section>;
  return (
    <form action={action} className="form-panel">
      <section className="form-section">
        <div className="section-heading"><h2>Run details</h2><p>The pay date selects the open accounting period automatically.</p></div>
        {state.error && <div className="form-error" role="alert">{state.error}</div>}
        <div className="form-grid">
          <AutoReferenceField label="Payroll reference" example="PAYROLL-2026-0001" />
          <label>Pay date <em>*</em><input name="payDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        </div>
      </section>
      <section className="form-section">
        <div className="section-heading"><h2>Employee pay inputs</h2><p>SPK is calculated from basic pay using the effective configured band. Overtime, allowances and bonuses are excluded from the SPK salary base for employees with a fixed basic salary. Confirm eligibility and exceptional wage arrangements before posting.</p></div>
        <div className="data-table-wrap"><table className="data-table payroll-entry-table"><thead><tr><th>Employee</th><th className="numeric">Basic pay</th><th className="numeric">Overtime</th><th className="numeric">Allowances</th><th className="numeric">Bonus</th><th className="numeric">Other deductions</th></tr></thead><tbody>
          {employees.map((employee) => <tr key={employee.id}><td><input type="hidden" name="employeeId" value={employee.id} /><strong>{employee.employeeNumber}</strong><small className="table-subtext">{employee.fullName}</small></td><td><input name="basicPay" type="number" min="0" step="0.01" defaultValue={employee.basicSalary} required /></td><td><input name="overtime" type="number" min="0" step="0.01" defaultValue="0.00" required /></td><td><input name="allowances" type="number" min="0" step="0.01" defaultValue="0.00" required /></td><td><input name="bonuses" type="number" min="0" step="0.01" defaultValue="0.00" required /></td><td><input name="otherDeductions" type="number" min="0" step="0.01" defaultValue="0.00" required /></td></tr>)}
        </tbody></table></div>
      </section>
      <div className="form-actions"><Link href="/payroll" className="button-secondary">Cancel</Link><button className="button-primary" disabled={pending}>{pending ? "Calculating…" : "Calculate and review"}</button></div>
    </form>
  );
}
