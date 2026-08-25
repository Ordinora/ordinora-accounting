import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

const money = (currency: string, value: unknown) =>
  `${currency} ${Number(value).toLocaleString("en-BN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>;
}) {
  const { id, entryId } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const entry = await db.payrollEntry.findFirst({
    where: {
      id: entryId,
      payrollRunId: id,
      payrollRun: { tenantId: active.id, status: { in: ["POSTED", "LOCKED"] } },
    },
    include: { employee: true, payrollRun: { include: { period: true } } },
  });

  if (!entry) notFound();

  const isFinalPay = entry.payrollRun.runType === "FINAL_PAY";
  const documentTitle = isFinalPay ? "Final payslip" : "Payslip";
  const earnings =
    Number(entry.basicPay) +
    Number(entry.overtime) +
    Number(entry.allowances) +
    Number(entry.bonuses) +
    Number(entry.leavePayout) +
    Number(entry.gratuity) +
    Number(entry.otherEarnings);
  const deductions = Number(entry.employeeSpk) + Number(entry.otherDeductions);

  return (
    <AppShell
      user={{
        displayName: user.displayName,
        email: user.email,
        role: user.staffRole?.replaceAll("_", " ") ?? "STAFF",
        firmName: user.firm.name,
      }}
      tenants={tenants}
      activeTenant={active}
      pageTitle={documentTitle}
      pageDescription={`${entry.employee.fullName} · ${entry.payrollRun.reference}`}
    >
      <main className="module-page">
        <div className="detail-toolbar">
          <Link href={`/payroll/runs/${id}`} className="back-link">
            ← Payroll run
          </Link>
          <Link
            className="button-secondary"
            href={`/payroll/runs/${id}/payslips/${entry.id}/pdf`}
          >
            <Download size={16} />
            Download PDF
          </Link>
        </div>
        <section className="surface-card form-panel">
          <header className="module-header">
            <div>
              <p className="eyebrow">{active.legalName.toUpperCase()}</p>
              <h2>{documentTitle}</h2>
              <p>
                {entry.payrollRun.period.name} · Pay date{" "}
                {entry.payrollRun.payDate.toLocaleDateString("en-BN")}
              </p>
            </div>
            <span className={`status-badge ${entry.payrollRun.status.toLowerCase()}`}>
              {entry.payrollRun.status}
            </span>
          </header>
          <div className="summary-grid">
            <div><small>Employee</small><strong>{entry.employee.fullName}</strong></div>
            <div><small>Employee number</small><strong>{entry.employee.employeeNumber}</strong></div>
            <div><small>Department</small><strong>{entry.employee.department ?? "—"}</strong></div>
            <div><small>Pay frequency</small><strong>{entry.employee.payFrequency}</strong></div>
          </div>
          <div className="statement-section">
            <h3>Earnings</h3>
            <table className="data-table">
              <tbody>
                <tr><td>Basic pay</td><td className="numeric">{money(active.defaultCurrency, entry.basicPay)}</td></tr>
                <tr><td>Overtime</td><td className="numeric">{money(active.defaultCurrency, entry.overtime)}</td></tr>
                <tr><td>Allowances</td><td className="numeric">{money(active.defaultCurrency, entry.allowances)}</td></tr>
                <tr><td>Bonuses</td><td className="numeric">{money(active.defaultCurrency, entry.bonuses)}</td></tr>
                {isFinalPay && <tr><td>Unused leave payout</td><td className="numeric">{money(active.defaultCurrency, entry.leavePayout)}</td></tr>}
                {isFinalPay && <tr><td>Gratuity / severance</td><td className="numeric">{money(active.defaultCurrency, entry.gratuity)}</td></tr>}
                {isFinalPay && <tr><td>Other earnings</td><td className="numeric">{money(active.defaultCurrency, entry.otherEarnings)}</td></tr>}
                <tr className="statement-total"><td><strong>Gross pay</strong></td><td className="numeric"><strong>{money(active.defaultCurrency, earnings)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="statement-section">
            <h3>Deductions and contributions</h3>
            <table className="data-table">
              <tbody>
                <tr><td>Employee SPK</td><td className="numeric">{money(active.defaultCurrency, entry.employeeSpk)}</td></tr>
                <tr><td>Other deductions</td><td className="numeric">{money(active.defaultCurrency, entry.otherDeductions)}</td></tr>
                <tr><td>Employer SPK contribution</td><td className="numeric">{money(active.defaultCurrency, entry.employerSpk)}</td></tr>
                <tr className="statement-total"><td><strong>Total employee deductions</strong></td><td className="numeric"><strong>{money(active.defaultCurrency, deductions)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          <div className="statement-grand-total">
            <strong>Net pay</strong>
            <strong>{money(active.defaultCurrency, entry.netPay)}</strong>
          </div>
        </section>
        <p className="form-notice">
          <span>
            This payslip reflects the posted payroll run. Verify statutory contribution and
            termination-entitlement rules before production use.
          </span>
        </p>
      </main>
    </AppShell>
  );
}
