import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { formatCurrencyAmount } from "@/lib/currency";
import { db } from "@/lib/db";
import { calculateProfitLoss } from "@/lib/profit-loss";
import { ledgerBalances } from "@/lib/reports";
import { requireActiveTenant } from "@/lib/session";
import { assertCanAccessAdministrationFeature } from "@/lib/staff-access";
import { financialYearStart } from "@/lib/year-end-close";
import { postYearEndClose } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  assertCanAccessAdministrationFeature(user.staffRole, "periods");
  const periods = await db.accountingPeriod.findMany({ where: { tenantId: active.id }, orderBy: { endsOn: "desc" } });
  const yearEnds = periods.filter((period) => period.endsOn.getUTCMonth() + 1 === active.financialYearEndMonth && period.endsOn.getUTCDate() === active.financialYearEndDay);
  const rows = await Promise.all(yearEnds.map(async (period) => {
    const startsOn = financialYearStart(period.endsOn);
    const statement = calculateProfitLoss(await ledgerBalances(active.id, startsOn, period.endsOn, { excludeYearEndClosing: true }));
    const activeClose = await db.journal.findFirst({ where: { tenantId: active.id, source: "YEAR_END_CLOSE", status: "POSTED", accountingDate: period.endsOn }, select: { id: true, reference: true } });
    const openEarlier = await db.accountingPeriod.count({ where: { tenantId: active.id, id: { not: period.id }, startsOn: { lte: period.endsOn }, endsOn: { gte: startsOn }, status: "OPEN" } });
    return { period, startsOn, netIncome: statement.netIncome, activeClose, openEarlier };
  }));

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Year-end close" pageDescription="Transfer annual profit or loss to retained earnings">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/settings/periods" className="back-link">← Accounting periods</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Year-end close</h2><p>Posts a closing journal that resets revenue and expense accounts and transfers annual net income or loss to account 3100 — Retained earnings.</p></div></header>
      {query.error && <div className="form-error" role="alert">{query.error}</div>}
      {query.success && <div className="form-success" role="status">{query.success}</div>}
      <div className="form-notice"><strong>Controlled accounting step</strong><span>Review and publish the final Income Statement first. Earlier months must be closed or locked. Closing journals remain visible in the audit trail and are excluded from Income Statement figures.</span></div>
      <section className="surface-card table-card">
        <div className="card-header"><div><h3>Financial years</h3><p>Years must be closed chronologically. No historical year is changed automatically.</p></div></div>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Financial year</th><th>Status</th><th className="numeric">Net income / (loss)</th><th>Close journal</th><th>Action</th></tr></thead><tbody>
          {rows.map(({ period, startsOn, netIncome, activeClose, openEarlier }) => {
            const year = period.endsOn.getUTCFullYear();
            const eligible = period.status === "OPEN" && !activeClose && openEarlier === 0;
            return <tr key={period.id}><td><strong>{startsOn.toISOString().slice(0, 10)}</strong> to <strong>{period.endsOn.toISOString().slice(0, 10)}</strong></td><td><span className={`status-badge ${period.status.toLowerCase()}`}>{activeClose ? "YEAR CLOSED" : period.status}</span></td><td className="numeric">{formatCurrencyAmount(active.defaultCurrency, netIncome)}</td><td>{activeClose ? <Link className="record-link" href={`/journals/${activeClose.id}`}>{activeClose.reference}</Link> : "—"}</td><td>{eligible ? <form action={postYearEndClose}><input type="hidden" name="periodId" value={period.id}/><label>Type CLOSE {year}<input name="confirmation" required autoComplete="off"/></label><button className="button-important">Post year-end close</button></form> : activeClose ? "Completed" : openEarlier ? "Close earlier months first" : "Open the year-end period to close"}</td></tr>;
          })}
          {!rows.length && <tr><td colSpan={5} className="table-empty">No accounting period ends on the configured financial year-end date. Create the missing period first.</td></tr>}
        </tbody></table></div>
      </section>
    </main>
  </AppShell>;
}
