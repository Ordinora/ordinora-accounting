import Link from "next/link";
import { Calculator, Plus, ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SourceRecordActions } from "@/components/source-record-actions";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const money = (currency: string, value: unknown) => `${currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page() {
  const { user, tenants, active } = await requireActiveTenant();
  const [employees, runs, bands] = await Promise.all([
    db.employee.findMany({ where: { tenantId: active.id }, orderBy: [{ status: "asc" }, { fullName: "asc" }] }),
    db.payrollRun.findMany({ where: { tenantId: active.id }, include: { period: true, entries: true, settlements: true }, orderBy: { payDate: "desc" }, take: 12 }),
    db.spkRateBand.findMany({ where: { tenantId: active.id }, orderBy: [{ effectiveFrom: "desc" }, { salaryFrom: "asc" }] }),
  ]);
  const activeEmployees = employees.filter((employee) => employee.status === "ACTIVE");
  const monthlyBasic = activeEmployees.reduce((sum, employee) => sum + Number(employee.basicSalary), 0);

  return (
    <AppShell
      user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
      tenants={tenants}
      activeTenant={active}
      pageTitle="Payroll"
      pageDescription="Employees, pay runs, SPK configuration, and payroll controls"
    >
      <main className="module-page">
        <header className="module-header">
          <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Payroll workspace</h2><p>Payroll data is separately permissioned and remains private from general financial-report access.</p></div>
          <div className="module-actions"><Link href="/payroll/employees/new" className="button-secondary"><Plus size={16} />New employee</Link><Link href="/payroll/runs/new" className="button-primary"><Calculator size={16} />Prepare payroll</Link></div>
        </header>

        <section className="kpi-grid payroll-kpis">
          <article className="kpi-card"><div className="kpi-label"><span>Active employees</span><Users size={18} /></div><strong>{activeEmployees.length}</strong><p>Tenant payroll register</p></article>
          <article className="kpi-card"><div className="kpi-label"><span>Monthly basic payroll</span><Calculator size={18} /></div><strong>{money(active.defaultCurrency, monthlyBasic)}</strong><p>Before overtime and allowances</p></article>
          <article className="kpi-card"><div className="kpi-label"><span>SPK rate bands</span><ShieldCheck size={18} /></div><strong>{bands.length}</strong><p>{bands.length ? "Configured contribution rules" : "Configuration required"}</p></article>
          <article className="kpi-card"><div className="kpi-label"><span>Payroll runs</span><Calculator size={18} /></div><strong>{runs.length}</strong><p>Draft, approved, posted, or locked</p></article>
        </section>

        <div className="form-notice"><strong>SPK review control</strong><span>The configured rates follow the published standard contribution bands. Confirm each employee&apos;s membership eligibility and salary base against current TAP requirements before posting payroll; special or transitional cases require payroll review.</span></div>

        <section className="surface-card table-card">
          <div className="card-header"><div><h3>Employee register</h3><p>Salary and SPK eligibility are visible only to authorized staff.</p></div></div>
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Name</th><th>Department</th><th>Pay basis</th><th>SPK</th><th>Status</th><th className="numeric">Basic salary</th></tr></thead><tbody>
            {employees.map((employee) => <tr key={employee.id}><td><strong>{employee.employeeNumber}</strong></td><td>{employee.fullName}</td><td>{employee.department || "—"}</td><td>{employee.payFrequency}</td><td><span className={`status-badge ${employee.schemeEligible ? "active" : ""}`}>{employee.schemeEligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</span></td><td><span className={`status-badge ${employee.status === "ACTIVE" ? "active" : ""}`}>{employee.status.replaceAll("_", " ")}</span></td><td className="numeric">{money(active.defaultCurrency, employee.basicSalary)}</td></tr>)}
            {!employees.length && <tr><td colSpan={7} className="table-empty">No employees have been added for this client.</td></tr>}
          </tbody></table></div>
        </section>

        <section className="surface-card table-card">
          <div className="card-header"><div><h3>Recent payroll runs</h3><p>Accounting status and payment status are tracked separately.</p></div></div>
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Period</th><th>Pay date</th><th>Accounting status</th><th>Payment status</th><th className="numeric">Outstanding</th><th className="numeric">Employees</th><th aria-label="Options"></th></tr></thead><tbody>
            {runs.map((run) => { const net=run.entries.reduce((sum,entry)=>sum+Number(entry.netPay),0),paid=run.settlements.reduce((sum,item)=>sum+Number(item.amount),0),outstanding=Math.max(0,net-paid),payable=["POSTED","LOCKED"].includes(run.status),paymentStatus=!payable?"NOT PAYABLE":outstanding<=0?"PAID":paid>0?"PART PAID":"OUTSTANDING";return <tr key={run.id}><td><Link className="record-link" href={`/payroll/runs/${run.id}`}>{run.reference}</Link></td><td>{run.period.name}</td><td>{run.payDate.toLocaleDateString("en-GB")}</td><td><span className={`status-badge ${run.status.toLowerCase()}`}>{run.status}</span></td><td><span className={`status-badge ${paymentStatus==="PAID"?"paid":paymentStatus==="OUTSTANDING"?"overdue":"pending"}`}>{paymentStatus}</span></td><td className="numeric">{payable?money(active.defaultCurrency,outstanding):"—"}</td><td className="numeric">{run.entries.length}</td><td><SourceRecordActions editHref={`/payroll/runs/${run.id}/edit`} journalId={run.journalId} payHref={payable&&outstanding>0?`/payroll/runs/${run.id}/payments/new`:undefined}/></td></tr>})}
            {!runs.length && <tr><td colSpan={8} className="table-empty">No payroll runs yet. Add employees before preparing the first run.</td></tr>}
          </tbody></table></div>
        </section>
      </main>
    </AppShell>
  );
}
