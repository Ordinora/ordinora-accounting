import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AlertTriangle, ArrowUpRight, Banknote, Building2, CalendarClock, CircleDollarSign, Landmark, Plus, ReceiptText, ShieldCheck, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StaffDashboardCharts } from "@/components/financial-charts";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { getBalanceTrendForRange, summarizeAging } from "@/lib/balance-trend";
import { calculateDashboardBalances } from "@/lib/dashboard-calculations";
import { dashboardDateRange } from "@/lib/dashboard-date-range";
import { requireTradeControlAccounts } from "@/lib/control-accounts";
import { customerSummary } from "@/lib/customer-reports";
import { db } from "@/lib/db";
import { journalDescriptionLabel } from "@/lib/journal-labels";
import { agedPayables, agedReceivables } from "@/lib/reports";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
const money = (value: number) => `B$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Home({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireStaff(); const { tenants, active } = await getAuthorizedTenant(user);
  if (!active && ["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(user.staffRole ?? "")) return <FirmAdminShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"ADMIN",firmName:user.firm.name}} pageTitle="Administrator dashboard" pageDescription="Firm-level setup and client-company management">
    <main className="module-page firm-onboarding-dashboard">
      <header className="module-header"><div><p className="eyebrow">{user.firm.name.toUpperCase()}</p><h2>Welcome, {user.displayName.split(" ")[0]}</h2><p>Your administrator account is active. Create the first company before entering accounting transactions.</p></div><Link href="/settings/companies/new" className="button-primary"><Plus size={16}/>Create first company</Link></header>
      <section className="firm-admin-summary">
        <article className="surface-card"><ShieldCheck/><div><small>YOUR ACCESS</small><strong>{user.staffRole?.replaceAll("_", " ")}</strong><p>Firm administration is available without a company.</p></div></article>
        <article className="surface-card"><Building2/><div><small>CLIENT COMPANIES</small><strong>0</strong><p>Create a separate accounting file for each client.</p></div></article>
        <article className="surface-card"><Users/><div><small>ACCOUNTING MODULES</small><strong>Waiting for company</strong><p>Accounting data must always belong to a selected company.</p></div></article>
      </section>
      <section className="surface-card firm-admin-next"><div><h3>Administration</h3><p>Start with the company register. The new company will receive its own chart of accounts, periods, users, transactions, and reports.</p></div><Link href="/settings/companies" className="button-secondary">Open company register</Link></section>
    </main>
  </FirmAdminShell>;
  if (!active) return <main className="empty-state"><h1>No assigned clients</h1><p>Ask a firm administrator to assign a client to your account.</p><form action={logout}><button className="button-secondary">Sign out</button></form></main>;
  const range = dashboardDateRange(await searchParams);
  const postedInRange: Prisma.JournalWhereInput = { tenantId: active.id, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { gte: range.from, lte: range.to } };
  const [journals, positionLines, activityLines, openPeriod, , trend, receivableRows, payableRows, customerRows] = await Promise.all([db.journal.findMany({ where: postedInRange, include: { lines: { include: { account: true } } }, orderBy: { createdAt: "desc" }, take: 8 }), db.journalLine.findMany({ where: { journal: { tenantId: active.id, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { lte: range.to } } }, include: { account: true } }), db.journalLine.findMany({ where: { journal: { ...postedInRange, NOT: [{ source: "YEAR_END_CLOSE" }, { source: "REVERSAL", reversalOf: { source: "YEAR_END_CLOSE" } }] } }, include: { account: true } }), db.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN" }, orderBy: { startsOn: "desc" } }), db.$transaction((tx)=>requireTradeControlAccounts(tx,active.id)), getBalanceTrendForRange(active.id, range.from, range.to), agedReceivables(active.id, range.to), agedPayables(active.id, range.to), customerSummary(active.id, range.from, range.to)]);
  for (const journal of journals) journal.description = journalDescriptionLabel(journal.source, journal.description);
  const positionBalances = calculateDashboardBalances(positionLines);
  const activityBalances = calculateDashboardBalances(activityLines);
  const aging = summarizeAging(receivableRows, payableRows);
  const topCustomers = customerRows.filter((row) => row.outstanding.gt(0)).sort((left, right) => right.outstanding.comparedTo(left.outstanding)).slice(0, 5).map((row) => ({ name: row.name, outstanding: Number(row.outstanding) }));
  const kpis=[{label:"Cash & bank balance",value:money(positionBalances.cashAndBank),hint:`Posted balance as of ${range.toInput}`,Icon:Landmark},{label:"Accounts receivable",value:money(positionBalances.receivables),hint:`Outstanding as of ${range.toInput}`,Icon:WalletCards},{label:"Accounts payable",value:money(positionBalances.payables),hint:`Outstanding as of ${range.toInput}`,Icon:ReceiptText},{label:"Net profit",value:money(activityBalances.netProfit),hint:`Accrual basis · ${range.fromInput} to ${range.toInput}`,Icon:CircleDollarSign}];
  return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Dashboard" pageDescription={`Financial overview for ${active.legalName}`}>
    <div className="dashboard-intro"><div><p className="eyebrow">{new Date().toLocaleDateString("en-BN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</p><h2>Good morning, {user.displayName.split(" ")[0]}</h2><p>Review the selected posted financial period and continue today’s accounting work.</p></div><div className="dashboard-controls"><div className="period-status"><span/><div><small>FINANCIAL PERIOD</small><strong>{openPeriod?.name??"No open period"}</strong></div></div></div></div>
    <form className="report-filter dashboard-date-filter"><label>From<input name="from" type="date" defaultValue={range.fromInput}/></label><label>To<input name="to" type="date" defaultValue={range.toInput}/></label><button className="button-secondary">Apply dates</button><Link href="/" className="button-secondary">Reset</Link></form>
    <div className="kpi-grid">{kpis.map(({label,value,hint,Icon})=><article className="kpi-card" key={label}><div className="kpi-label"><span>{label}</span><Icon size={19}/></div><strong>{value}</strong><p><ArrowUpRight size={14}/>{hint}</p></article>)}</div>
    <StaffDashboardCharts trend={trend} aging={aging} customers={topCustomers} currency={active.defaultCurrency} periodLabel={`${range.fromInput} to ${range.toInput}`}/>
    <div className="dashboard-grid"><section className="surface-card span-two"><div className="card-header"><div><h3>Recent transactions</h3><p>Latest posted entries in the selected date range</p></div><Link href="/journals" className="button-secondary">View journal entries</Link></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Accounting date</th><th>Description</th><th>Status</th><th className="numeric">Amount (BND)</th></tr></thead><tbody>{journals.map((journal)=><tr key={journal.id}><td><Link className="record-link" href={`/journals/${journal.id}`}>{journal.reference}</Link></td><td>{journal.accountingDate.toLocaleDateString("en-BN")}</td><td>{journal.description}</td><td><span className={`status-badge ${journal.status.toLowerCase()}`}>{journal.status}</span></td><td className="numeric money">{money(journal.lines.reduce((sum,line)=>sum+Number(line.debit),0))}</td></tr>)}{!journals.length&&<tr><td colSpan={5}><div className="table-empty">No posted transactions in this date range.</div></td></tr>}</tbody><tfoot><tr><td colSpan={4}>Displayed total</td><td className="numeric">{money(journals.reduce((total,journal)=>total+journal.lines.reduce((sum,line)=>sum+Number(line.debit),0),0))}</td></tr></tfoot></table></div></section>
      <aside className="surface-card"><div className="card-header"><div><h3>Accounting status</h3><p>Controls and outstanding work</p></div></div><div className="status-list"><div><span className="status-icon success"><Banknote size={18}/></span><div><strong>Ledger balanced</strong><small>Posted debits equal credits</small></div></div><div><span className="status-icon warning"><CalendarClock size={18}/></span><div><strong>{openPeriod?"Period open":"Period attention"}</strong><small>{openPeriod?.name??"Configure an open period"}</small></div></div><div><span className="status-icon warning"><AlertTriangle size={18}/></span><div><strong>Reconciliation pending</strong><small>Banking module planned</small></div></div></div><Link href="/journals/new" className="button-primary full-button">Post a journal</Link></aside>
    </div>
  </AppShell>;
}
