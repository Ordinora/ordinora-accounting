import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { updateEmployee } from "../actions";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params, query = await searchParams, { user, tenants, active } = await requireActiveTenant();
  const employee = await db.employee.findFirst({ where: { id, tenantId: active.id }, include: { _count: { select: { payrollEntries: true } } } });
  if (!employee) notFound();
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={employee.fullName} pageDescription="Edit employment, pay and lifecycle status"><main className="module-page form-page">
    <div className="detail-toolbar"><Link href="/payroll/employees" className="back-link">← Employee register</Link></div>
    {query.error && <div className="form-error" role="alert">{query.error}</div>}
    <div className="form-notice"><strong>{employee._count.payrollEntries} payroll record(s)</strong><span>Historical payroll entries remain unchanged. Salary and status updates affect only future payroll runs.</span></div>
    <form action={updateEmployee.bind(null, employee.id)} className="surface-card form-panel"><section className="form-section"><div className="section-heading"><h2>Employment information</h2><p>Use On Leave to exclude an employee temporarily, or Terminated with an end date to close employment.</p></div><div className="form-grid">
      <label>Employee number<input name="employeeNumber" required defaultValue={employee.employeeNumber} /></label><label>Full name<input name="fullName" required defaultValue={employee.fullName} /></label>
      <label>Identity reference<input name="identityReference" defaultValue={employee.identityReference ?? ""} /></label>
      <label>Citizenship / residency<select name="citizenship" required defaultValue={employee.citizenship}><option value="Brunei citizen">Brunei citizen</option><option value="Permanent resident">Permanent resident</option><option value="Foreign national / temporary resident">Foreign national / temporary resident</option><option value="Other">Other</option></select></label>
      <label>Identity-card category<select name="identityCardCategory" required defaultValue={employee.identityCardCategory ?? "Passport or other document"}><option value="Yellow identity card">Yellow — Brunei citizen</option><option value="Purple identity card">Purple — permanent resident</option><option value="Green identity card">Green — foreign/temporary resident</option><option value="Passport or other document">Passport or other document</option></select></label>
      <label>Department<input name="department" defaultValue={employee.department ?? ""} /></label><label>Employment start<input name="employmentStart" type="date" required defaultValue={employee.employmentStart.toISOString().slice(0, 10)} /></label><label>Employment end<input name="employmentEnd" type="date" defaultValue={employee.employmentEnd?.toISOString().slice(0, 10) ?? ""} /></label>
      <label>Status<select name="status" defaultValue={employee.status}><option value="ACTIVE">Active</option><option value="ON_LEAVE">On leave</option><option value="TERMINATED">Terminated</option></select></label><label>Pay frequency<select name="payFrequency" defaultValue={employee.payFrequency}><option value="MONTHLY">Monthly</option><option value="HOURLY">Hourly</option></select></label>
      <label>Basic monthly salary ({active.defaultCurrency})<input name="basicSalary" type="number" min="0" step="0.01" required defaultValue={Number(employee.basicSalary).toFixed(2)} /></label><label>Hourly rate ({active.defaultCurrency})<input name="hourlyRate" type="number" min="0" step="0.01" defaultValue={employee.hourlyRate ? Number(employee.hourlyRate).toFixed(2) : ""} /></label>
      <label>SPK eligible<select name="schemeEligible" defaultValue={employee.schemeEligible ? "yes" : "no"}><option value="yes">Yes</option><option value="no">No</option></select></label><label className="span-2">Reason for change<input name="reason" required minLength={5} maxLength={240} /></label>
    </div></section><div className="form-actions"><Link href="/payroll/employees" className="button-secondary">Cancel</Link><button className="button-primary">Save employee</button></div></form>
  </main></AppShell>;
}
