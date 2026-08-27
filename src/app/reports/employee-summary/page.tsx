import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { employeePayrollSummary, payrollEntriesForPeriod, payrollReportTotals } from "@/lib/payroll-reports";
import { formatCurrencyAmount } from "@/lib/currency";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const date = (value: string | undefined, fallback: Date) => value ? new Date(`${value}T00:00:00`) : fallback;
const money = formatCurrencyAmount;

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  const now = new Date();
  const from = date(query.from, new Date(now.getFullYear(), 0, 1));
  const to = date(query.to, now);
  const entries = await payrollEntriesForPeriod(active.id, from, to);
  const rows = employeePayrollSummary(entries);
  const totals = payrollReportTotals(entries);
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Employee Summary" pageDescription="Posted payroll totals by employee">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Employee Summary</h2><p>{from.toLocaleDateString("en-BN")} to {to.toLocaleDateString("en-BN")} · Posted and locked payroll</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0, 10)} /></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0, 10)} /></label><button className="button-secondary">Update</button></form><Link className="button-secondary" href={`/reports/employee-summary/pdf?${range}`}><Download size={16} />Export PDF</Link></div></header>
      <div className="summary-grid"><div><small>Employees paid</small><strong>{rows.length}</strong></div><div><small>Gross pay</small><strong>{money(active.defaultCurrency, totals.gross)}</strong></div><div><small>Employee SPK</small><strong>{money(active.defaultCurrency, totals.employeeSpk)}</strong></div><div><small>Net pay</small><strong>{money(active.defaultCurrency, totals.net)}</strong></div></div>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th>Department</th><th className="numeric">Pay entries</th><th className="numeric">Gross</th><th className="numeric">Employee SPK</th><th className="numeric">Other deductions</th><th className="numeric">Employer SPK</th><th className="numeric">Net pay</th></tr></thead><tbody>{rows.map(row => <tr key={row.employeeId}><td><strong>{row.employeeNumber}</strong><br />{row.fullName}</td><td>{row.department ?? "—"}</td><td className="numeric">{row.runs}</td><td className="numeric">{money(active.defaultCurrency, row.gross)}</td><td className="numeric">{money(active.defaultCurrency, row.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, row.deductions)}</td><td className="numeric">{money(active.defaultCurrency, row.employerSpk)}</td><td className="numeric"><strong>{money(active.defaultCurrency, row.net)}</strong></td></tr>)}{!rows.length && <tr><td colSpan={8} className="table-empty">No posted payroll entries in this period.</td></tr>}</tbody><tfoot><tr><td colSpan={3}>Totals</td><td className="numeric">{money(active.defaultCurrency, totals.gross)}</td><td className="numeric">{money(active.defaultCurrency, totals.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.deductions)}</td><td className="numeric">{money(active.defaultCurrency, totals.employerSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.net)}</td></tr></tfoot></table></div></section>
    </main>
  </AppShell>;
}
