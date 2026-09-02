import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { dashboardDateRange } from "@/lib/dashboard-date-range";
import { agedPayables, agedReceivables, ledgerBalances } from "@/lib/reports";
import { requireClientFinancialAccess } from "@/lib/session";

export const dynamic = "force-dynamic";

const zero = new Prisma.Decimal(0);
const money = (currency: string, value: Prisma.Decimal.Value) => `${currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const names: Record<string, string> = { cash: "Cash & bank", revenue: "Revenue", receivables: "Accounts receivable", payables: "Accounts payable", profit: "Net profit" };

export default async function LiveDrilldownPage({ params, searchParams }: { params: Promise<{ metric: string }>; searchParams: Promise<{ from?: string; to?: string; view?: string }> }) {
  const { metric } = await params;
  const query = await searchParams;
  const user = await requireClientFinancialAccess();
  const tenant = user.tenant!;

  if (tenant.reportMode !== "LIVE_POSTED_AND_PUBLISHED" || !tenant.enabledDashboardCards.includes(metric) || !names[metric]) notFound();

  const latestLive = query.view === "live" || (!query.from && !query.to);
  const range = dashboardDateRange(query);
  const asOf = latestLive ? new Date() : range.to;
  const activityFrom = latestLive ? undefined : range.from;
  const isActivity = metric === "revenue" || metric === "profit";
  const backHref = latestLive ? "/portal" : `/portal?from=${range.fromInput}&to=${range.toInput}`;
  let heads: string[] = [];
  let rows: string[][] = [];

  if (metric === "receivables" || metric === "payables") {
    const balances = metric === "receivables" ? await agedReceivables(tenant.id, asOf) : await agedPayables(tenant.id, asOf);
    heads = ["Reference", metric === "receivables" ? "Customer" : "Supplier", "Due date", "Age", "Outstanding"];
    rows = balances.map((row) => [row.reference, row.party, row.due.toLocaleDateString("en-BN"), row.bucket, money(tenant.defaultCurrency, row.outstanding)]);
  } else {
    const balances = await ledgerBalances(tenant.id, metric === "cash" ? undefined : activityFrom, asOf, { excludeYearEndClosing: !latestLive && metric !== "cash" });
    const filtered = metric === "cash"
      ? balances.filter((row) => row.type === "ASSET" && row.classification === "Cash and cash equivalents")
      : metric === "revenue"
        ? balances.filter((row) => row.type === "REVENUE")
        : balances.filter((row) => row.type === "REVENUE" || row.type === "EXPENSE");

    heads = ["Code", "Account", "Classification", "Amount"];
    rows = filtered.map((row) => {
      const value = row.type === "REVENUE" ? row.credit.sub(row.debit) : row.debit.sub(row.credit);
      return [row.code, row.name, row.classification, money(tenant.defaultCurrency, value)];
    });

    if (metric === "profit") {
      const revenue = filtered.filter((row) => row.type === "REVENUE").reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero);
      const expenses = filtered.filter((row) => row.type === "EXPENSE").reduce((sum, row) => sum.add(row.debit.sub(row.credit)), zero);
      rows.push(["", "Net profit / (loss)", "Accrual accounting · revenue less expenses", money(tenant.defaultCurrency, revenue.sub(expenses))]);
    }
  }

  const periodText = isActivity
    ? latestLive ? `All posted activity through ${asOf.toLocaleString("en-BN")}` : `${range.fromInput} to ${range.toInput}`
    : `As of ${latestLive ? asOf.toLocaleString("en-BN") : range.toInput}`;

  return <main className="portal-page">
    <header className="portal-header"><div><strong>Ordinora</strong><span>Client Portal</span></div><Link href={backHref} className="button-secondary">Back to dashboard</Link></header>
    <section className="portal-content">
      <header className="module-header"><div><p className="eyebrow">{latestLive ? "LATEST LIVE POSTED REPORT" : "FILTERED POSTED REPORT"}</p><h2>{names[metric]}</h2><p>{periodText} · {metric === "profit" ? "Accrual accounting · " : ""}posted entries only</p></div><Link href={backHref} className="button-secondary">Back to dashboard</Link></header>
      <form className="report-filter dashboard-date-filter">
        <label>From<input name="from" type="date" defaultValue={range.fromInput}/></label>
        <label>To<input name="to" type="date" defaultValue={range.toInput}/></label>
        <button className="button-secondary">Apply dates</button>
        <Link href={`/portal/live/${metric}?view=live`} className="button-secondary">View latest live data</Link>
      </form>
      {!isActivity && <div className="form-notice"><span>This is a balance report, so the selected To date sets the reporting date. The From date is retained when you return to the dashboard.</span></div>}
      <div className="form-notice"><span>{latestLive ? "This latest live view includes posted activity through now and can change when your accountant posts or corrects transactions." : "This view uses the dashboard date selection. Change the dates above or choose latest live data."} Published reports remain fixed versions.</span></div>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr>{heads.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex === row.length - 1 ? "numeric" : ""}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={heads.length} className="table-empty">No posted balances are available for this selection.</td></tr>}</tbody></table></div></section>
    </section>
  </main>;
}
