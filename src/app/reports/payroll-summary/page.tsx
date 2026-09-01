import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { payrollEntriesForPeriod, payrollEntryGross, payrollReportTotals } from "@/lib/payroll-reports";
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
  const totals = payrollReportTotals(entries);
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Payroll Run Summary" pageDescription="Posted payroll entries and contribution totals">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Payroll Run Summary</h2><p>{from.toLocaleDateString("en-BN")} to {to.toLocaleDateString("en-BN")} · Posted payroll and opening YTD</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0, 10)} /></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0, 10)} /></label><button className="button-secondary">Update</button></form><Link className="button-secondary" href={`/reports/payroll-summary/pdf?${range}`}><Download size={16} />Export PDF</Link></div></header>
      <div className="summary-grid"><div><small>Pay entries</small><strong>{entries.length}</strong></div><div><small>Gross pay</small><strong>{money(active.defaultCurrency, totals.gross)}</strong></div><div><small>Total employer SPK</small><strong>{money(active.defaultCurrency, totals.employerSpk)}</strong></div><div><small>Net pay</small><strong>{money(active.defaultCurrency, totals.net)}</strong></div></div>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Pay date</th><th>Run</th><th>Employee</th><th>Type</th><th className="numeric">Gross</th><th className="numeric">Employee SPK</th><th className="numeric">Other deductions</th><th className="numeric">Employer SPK</th><th className="numeric">Net pay</th></tr></thead><tbody>{entries.map(entry => <tr key={`${entry.isOpeningYtd?"opening":"payroll"}-${entry.id}`}><td>{entry.reportDate.toLocaleDateString("en-BN")}</td><td>{entry.reportRunId?<Link className="record-link" href={`/payroll/runs/${entry.reportRunId}`}>{entry.reportReference}</Link>:<strong>{entry.reportReference}</strong>}</td><td>{entry.employee.employeeNumber} · {entry.employee.fullName}</td><td>{entry.reportType}</td><td className="numeric">{money(active.defaultCurrency, payrollEntryGross(entry))}</td><td className="numeric">{money(active.defaultCurrency, entry.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, entry.otherDeductions)}</td><td className="numeric">{money(active.defaultCurrency, entry.employerSpk)}</td><td className="numeric"><strong>{money(active.defaultCurrency, entry.netPay)}</strong></td></tr>)}{!entries.length && <tr><td colSpan={9} className="table-empty">No payroll or opening YTD entries in this period.</td></tr>}</tbody><tfoot><tr><td colSpan={4}>Totals</td><td className="numeric">{money(active.defaultCurrency, totals.gross)}</td><td className="numeric">{money(active.defaultCurrency, totals.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.deductions)}</td><td className="numeric">{money(active.defaultCurrency, totals.employerSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.net)}</td></tr></tfoot></table></div></section>
    </main>
  </AppShell>;
}
