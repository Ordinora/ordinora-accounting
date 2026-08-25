import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { approveRun, lockPayrollRun, postRun } from "../../actions";

export const dynamic = "force-dynamic";
const money = (currency: string, value: unknown) => `${currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const run = await db.payrollRun.findFirst({ where: { id, tenantId: active.id }, include: { period: true, settlements: { include: { bankAccount: true }, orderBy: { paymentDate: "desc" } }, entries: { include: { employee: true }, orderBy: { employee: { fullName: "asc" } } } } });
  if (!run) notFound();
  const totals = run.entries.reduce((sum, entry) => ({ gross: sum.gross + Number(entry.grossPay), employeeSpk: sum.employeeSpk + Number(entry.employeeSpk), employerSpk: sum.employerSpk + Number(entry.employerSpk), deductions: sum.deductions + Number(entry.otherDeductions), net: sum.net + Number(entry.netPay) }), { gross: 0, employeeSpk: 0, employerSpk: 0, deductions: 0, net: 0 });
  const paid=run.settlements.reduce((sum,item)=>sum+Number(item.amount),0),outstanding=Math.max(0,totals.net-paid);
  return (
    <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={run.reference} pageDescription="Payroll calculation, approval, and journal posting">
      <main className="module-page">
        <div className="detail-toolbar"><Link href="/payroll" className="back-link">← Back to payroll</Link><span className={`status-badge large ${run.status.toLowerCase()}`}>{run.status}</span></div>
        <header className="module-header">
          <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>{run.reference}</h2><p>{run.period.name} · Pay date {run.payDate.toLocaleDateString("en-GB")}</p></div>
          <div className="workflow-actions">
            {run.status === "DRAFT" && <form action={approveRun}><input type="hidden" name="runId" value={run.id} /><button className="button-important">Approve payroll</button></form>}
            {run.status === "DRAFT" && <Link href={`/payroll/runs/${run.id}/inputs/edit`} className="button-secondary">Edit pay inputs</Link>}
            {run.status === "APPROVED" && <form action={postRun}><input type="hidden" name="runId" value={run.id} /><button className="button-primary">Post payroll journal</button></form>}
            {run.status === "POSTED" && <form action={lockPayrollRun}><input type="hidden" name="runId" value={run.id}/><input name="confirmation" required pattern="LOCK" placeholder="Type LOCK" aria-label="Type LOCK to confirm"/><button className="button-important">Lock payroll run</button></form>}
            {run.journalId && <Link href={`/journals/${run.journalId}`} className="button-secondary">View journal</Link>}
            {["POSTED","LOCKED"].includes(run.status)&&outstanding>0&&<Link href={`/payroll/runs/${run.id}/payments/new`} className="button-primary">Pay payroll</Link>}
          </div>
        </header>
        <section className="summary-grid payroll-summary"><div><small>Gross payroll</small><strong>{money(active.defaultCurrency, totals.gross)}</strong></div><div><small>Employee SPK</small><strong>{money(active.defaultCurrency, totals.employeeSpk)}</strong></div><div><small>Employer SPK cost</small><strong>{money(active.defaultCurrency, totals.employerSpk)}</strong></div><div><small>Net payroll payable</small><strong>{money(active.defaultCurrency, totals.net)}</strong></div></section>
        <section className="surface-card table-card">
          <div className="card-header"><div><h3>Payroll calculation</h3><p>Review employee amounts before approval. Posted payroll is immutable and must be corrected through an adjusting process.</p></div></div>
          <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Employee</th><th className="numeric">Basic</th><th className="numeric">Other earnings</th><th className="numeric">Gross</th><th className="numeric">Employee SPK</th><th className="numeric">Employer SPK</th><th className="numeric">Other deductions</th><th className="numeric">Net pay</th></tr></thead><tbody>
            {run.entries.map((entry) => <tr key={entry.id}><td><strong>{entry.employee.employeeNumber}</strong><small className="table-subtext">{entry.employee.fullName}</small>{["POSTED","LOCKED"].includes(run.status)&&<Link className="record-link" href={`/payroll/runs/${run.id}/payslips/${entry.id}`}>View payslip</Link>}</td><td className="numeric">{money(active.defaultCurrency, entry.basicPay)}</td><td className="numeric">{money(active.defaultCurrency, Number(entry.overtime) + Number(entry.allowances) + Number(entry.bonuses))}</td><td className="numeric money">{money(active.defaultCurrency, entry.grossPay)}</td><td className="numeric">{money(active.defaultCurrency, entry.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, entry.employerSpk)}</td><td className="numeric">{money(active.defaultCurrency, entry.otherDeductions)}</td><td className="numeric money">{money(active.defaultCurrency, entry.netPay)}</td></tr>)}
          </tbody><tfoot><tr><td>Total</td><td /><td /><td className="numeric">{money(active.defaultCurrency, totals.gross)}</td><td className="numeric">{money(active.defaultCurrency, totals.employeeSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.employerSpk)}</td><td className="numeric">{money(active.defaultCurrency, totals.deductions)}</td><td className="numeric">{money(active.defaultCurrency, totals.net)}</td></tr></tfoot></table></div>
        </section>
        {["POSTED","LOCKED"].includes(run.status)&&<section className="surface-card table-card"><div className="card-header"><div><h3>Payroll payments</h3><p>Paid {money(active.defaultCurrency,paid)} · Outstanding {money(active.defaultCurrency,outstanding)}</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Paid from</th><th className="numeric">Amount</th><th>Journal</th></tr></thead><tbody>{run.settlements.map(item=><tr key={item.id}><td><strong>{item.reference}</strong></td><td>{item.paymentDate.toLocaleDateString("en-BN")}</td><td>{item.bankAccount.code} — {item.bankAccount.name}</td><td className="numeric">{money(active.defaultCurrency,item.amount)}</td><td><Link className="record-link" href={`/journals/${item.journalId}`}>View</Link></td></tr>)}{!run.settlements.length&&<tr><td colSpan={5} className="table-empty">No payroll payments posted.</td></tr>}</tbody></table></div></section>}
        <p className="form-notice payroll-disclaimer"><strong>Demonstration SPK configuration</strong><span>Contribution rules and eligibility must be verified by a Brunei-qualified payroll professional before production use.</span></p>
      </main>
    </AppShell>
  );
}
