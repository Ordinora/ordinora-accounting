import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { OpeningPayrollForm } from "@/components/opening-payroll-form";
import { formatCurrencyAmount } from "@/lib/currency";
import { db } from "@/lib/db";
import { assertOpeningPayrollRole } from "@/lib/opening-payroll";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  assertOpeningPayrollRole(user.staffRole);
  const [opening, employees, records] = await Promise.all([
    db.journal.findFirst({ where: { tenantId: active.id, source: "OPENING_BALANCE", status: "POSTED", description: "Opening balances at conversion date" }, orderBy: { accountingDate: "desc" } }),
    db.employee.findMany({ where: { tenantId: active.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    db.openingPayrollYtd.findMany({ where: { tenantId: active.id }, include: { employee: true }, orderBy: { employee: { fullName: "asc" } } }),
  ]);
  const entered = new Set(records.map((record) => record.employeeId));
  const available = employees.filter((employee) => !entered.has(employee.id));
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Opening Payroll YTD" pageDescription="Bring forward employee payroll totals without duplicating payroll postings">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Opening payroll year-to-date</h2><p>Record payroll totals supplied by the previous bookkeeper for employees onboarded mid-year.</p></div><Link href="/settings/opening-checklist" className="button-secondary">Opening checklist</Link></header>
      {query.success && <div className="form-success" role="status">{query.success}</div>}
      {!opening && <div className="form-notice"><strong>Opening balance required first</strong><span>Post the company opening general-ledger balance to establish the conversion date.</span><Link href="/settings/opening-balances" className="button-secondary">Opening balances</Link></div>}
      <section className="surface-card table-card"><div className="card-heading"><div><h3>Recorded employee YTD figures</h3><p>{records.length} of {employees.length} active employees entered</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>As at</th><th className="numeric">Gross pay</th><th className="numeric">Employee SPK/TAP</th><th className="numeric">Employer SPK/TAP</th><th className="numeric">Other deductions</th><th className="numeric">Net pay</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td><strong>{record.employee.employeeNumber}</strong><small className="table-subtext">{record.employee.fullName}</small></td><td>{record.asOfDate.toLocaleDateString("en-BN")}</td><td className="numeric">{formatCurrencyAmount(active.defaultCurrency, record.grossPay)}</td><td className="numeric">{formatCurrencyAmount(active.defaultCurrency, record.employeeSpk)}</td><td className="numeric">{formatCurrencyAmount(active.defaultCurrency, record.employerSpk)}</td><td className="numeric">{formatCurrencyAmount(active.defaultCurrency, record.otherDeductions)}</td><td className="numeric"><strong>{formatCurrencyAmount(active.defaultCurrency, record.netPay)}</strong></td></tr>)}{!records.length && <tr><td colSpan={7} className="table-empty">No opening payroll YTD figures entered.</td></tr>}</tbody></table></div></section>
      {opening && available.length > 0 && <OpeningPayrollForm employees={available} conversionDate={opening.accountingDate.toLocaleDateString("en-BN")} />}
      {opening && employees.length > 0 && !available.length && <div className="form-success">Opening payroll YTD figures are recorded for every active employee.</div>}
      {opening && !employees.length && <div className="form-notice"><strong>Not applicable</strong><span>No active employees are configured for this company.</span></div>}
    </main>
  </AppShell>;
}
