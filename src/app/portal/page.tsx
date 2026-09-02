import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PortalFinancialCharts } from "@/components/financial-charts";
import { getBalanceTrendForRange, summarizeAging } from "@/lib/balance-trend";
import { calculateDashboardBalances } from "@/lib/dashboard-calculations";
import { dashboardDateRange } from "@/lib/dashboard-date-range";
import { db } from "@/lib/db";
import { agedReceivables } from "@/lib/reports";
import { canClientViewFinancials, requireClient } from "@/lib/session";
import { portalLogout } from "./actions";

export const dynamic = "force-dynamic";

async function LivePostingTimestamp({ tenantId }: { tenantId: string }) {
  const latest = await db.journal.findFirst({ where: { tenantId, status: { in: ["POSTED", "REVERSED"] } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
  return <p className="portal-freshness">Last posted update: {latest?.updatedAt.toLocaleString("en-BN") ?? "No posted entries"}</p>;
}

const money = (currency: string, value: number) => `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ClientPortalPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireClient();
  const tenant = user.tenant!;
  const financialAccess = canClientViewFinancials(user.clientRole);
  const liveAccess = financialAccess && tenant.reportMode === "LIVE_POSTED_AND_PUBLISHED";
  const enabled = new Set(tenant.enabledDashboardCards);
  const showRevenue = liveAccess && enabled.has("revenue");
  const showProfit = liveAccess && enabled.has("profit");
  const showReceivables = liveAccess && enabled.has("receivables");
  const needsTrend = showRevenue || showProfit;
  const range = dashboardDateRange(await searchParams);
  const postedInRange: Prisma.JournalWhereInput = { tenantId: tenant.id, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { gte: range.from, lte: range.to } };

  const [reports, positionLines, activityLines, trend, receivables] = await Promise.all([
    financialAccess ? db.reportVersion.findMany({ where: { tenantId: tenant.id, state: "PUBLISHED" }, include: { period: true }, orderBy: { publishedAt: "desc" } }) : Promise.resolve([]),
    liveAccess ? db.journalLine.findMany({ where: { journal: { tenantId: tenant.id, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { lte: range.to } } }, include: { account: true } }) : Promise.resolve([]),
    liveAccess ? db.journalLine.findMany({ where: { journal: { ...postedInRange, NOT: [{ source: "YEAR_END_CLOSE" }, { source: "REVERSAL", reversalOf: { source: "YEAR_END_CLOSE" } }] } }, include: { account: true } }) : Promise.resolve([]),
    needsTrend ? getBalanceTrendForRange(tenant.id, range.from, range.to) : Promise.resolve([]),
    showReceivables ? agedReceivables(tenant.id, range.to) : Promise.resolve([]),
  ]);

  const positionBalances = calculateDashboardBalances(positionLines);
  const activityBalances = calculateDashboardBalances(activityLines);
  const revenue = activityLines.filter((line) => line.account.type === "REVENUE").reduce((sum, line) => sum + Number(line.credit) - Number(line.debit), 0);
  const cards = { cash: ["Cash & bank", positionBalances.cashAndBank], revenue: ["Revenue", revenue], receivables: ["Accounts receivable", positionBalances.receivables], payables: ["Accounts payable", positionBalances.payables], profit: ["Net profit", activityBalances.netProfit] } as const;
  const aging = summarizeAging(receivables, []);

  return <main className="portal-page">
    <header className="portal-header"><div><strong>Ordinora</strong><span>Client Portal</span></div><div><Link href="/portal/documents">Documents</Link><Link href="/portal/questions">Questions</Link><span>{user.displayName}</span><form action={portalLogout}><button className="button-secondary">Sign out</button></form></div></header>
    <section className="portal-content">
      <div className="dashboard-intro"><div><p className="eyebrow">{tenant.legalName.toUpperCase()}</p><h2>Financial overview</h2><p>Income and profit use accrual accounting from posted entries.</p>{liveAccess && <LivePostingTimestamp tenantId={tenant.id}/>}</div><div className="dashboard-controls"><span className="status-badge active">{tenant.reportMode === "PUBLISHED_ONLY" ? "PUBLISHED REPORTS" : "LIVE POSTED"}</span></div></div>
      {liveAccess && <form className="report-filter dashboard-date-filter"><label>From<input name="from" type="date" defaultValue={range.fromInput}/></label><label>To<input name="to" type="date" defaultValue={range.toInput}/></label><button className="button-secondary">Apply dates</button><Link href="/portal" className="button-secondary">Reset</Link></form>}
      {liveAccess && <div className="kpi-grid">{tenant.enabledDashboardCards.map((key) => { const card = cards[key as keyof typeof cards]; if (!card) return null; const [label, value] = card; const periodCopy = key === "revenue" || key === "profit" ? `${range.fromInput} to ${range.toInput}` : `As of ${range.toInput}`; return <Link href={`/portal/live/${key}`} className="kpi-card portal-kpi-link" key={key}><div className="kpi-label"><span>{label}</span></div><strong>{money(tenant.defaultCurrency, value)}</strong><p>{periodCopy} · Open drill-down</p></Link>; })}</div>}
      {liveAccess && (needsTrend || showReceivables) && <PortalFinancialCharts trend={trend} aging={aging} currency={tenant.defaultCurrency} showRevenue={showRevenue} showProfit={showProfit} showReceivables={showReceivables} periodLabel={`${range.fromInput} to ${range.toInput}`}/>}
      <section className="surface-card table-card portal-report-list"><div className="card-header"><div><h3>Published reports</h3><p>Reports specifically released by your accountant.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Report</th><th>Period</th><th>Version</th><th>Published</th><th></th></tr></thead><tbody>{reports.map((report) => <tr key={report.id}><td><strong>{report.reportType.replaceAll("_", " ")}</strong></td><td>{report.period.name}</td><td>{report.version}</td><td>{report.publishedAt?.toLocaleDateString("en-BN") ?? "—"}</td><td><Link className="table-action" href={`/portal/reports/${report.id}`}>Open</Link></td></tr>)}{!reports.length && <tr><td colSpan={5} className="table-empty">No reports have been published yet.</td></tr>}</tbody></table></div></section>
    </section>
  </main>;
}
