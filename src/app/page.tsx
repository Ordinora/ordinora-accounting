import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Banknote, CalendarClock, CircleDollarSign, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { calculateDashboardBalances } from "@/lib/dashboard-calculations";
import { db } from "@/lib/db";
import { journalDescriptionLabel } from "@/lib/journal-labels";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
const money = (value: number) => `B$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Home() {
  const user = await requireStaff(); const { tenants, active } = await getAuthorizedTenant(user);
  if (!active) return <main className="empty-state"><h1>No assigned clients</h1><p>Ask a firm administrator to assign a client to your account.</p><form action={logout}><button className="button-secondary">Sign out</button></form></main>;
  const [journals, ledgerLines, openPeriod] = await Promise.all([db.journal.findMany({ where: { tenantId: active.id, status: { in: ["POSTED","REVERSED"] } }, include: { lines: { include: { account: true } } }, orderBy: { createdAt: "desc" }, take: 8 }), db.journalLine.findMany({ where: { journal: { tenantId: active.id, status: { in: ["POSTED", "REVERSED"] } } }, include: { account: true } }), db.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN" }, orderBy: { startsOn: "desc" } })]);
  for (const journal of journals) journal.description = journalDescriptionLabel(journal.source, journal.description);
  const balances = calculateDashboardBalances(ledgerLines);
  const kpis=[{label:"Cash & bank balance",value:money(balances.cashAndBank),hint:"All posted cash and bank accounts",Icon:Landmark},{label:"Accounts receivable",value:money(balances.receivables),hint:"Outstanding customers",Icon:WalletCards},{label:"Accounts payable",value:money(balances.payables),hint:"Outstanding suppliers",Icon:ReceiptText},{label:"Net profit",value:money(balances.netProfit),hint:"Accrual basis · posted income less expenses",Icon:CircleDollarSign}];
  return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Dashboard" pageDescription={`Financial overview for ${active.legalName}`}>
    <div className="dashboard-intro"><div><p className="eyebrow">{new Date().toLocaleDateString("en-BN",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).toUpperCase()}</p><h2>Good morning, {user.displayName.split(" ")[0]}</h2><p>Review the latest posted position and continue today’s accounting work.</p></div><div className="dashboard-controls"><div className="period-status"><span/><div><small>FINANCIAL PERIOD</small><strong>{openPeriod?.name??"No open period"}</strong></div></div></div></div>
    <div className="kpi-grid">{kpis.map(({label,value,hint,Icon})=><article className="kpi-card" key={label}><div className="kpi-label"><span>{label}</span><Icon size={19}/></div><strong>{value}</strong><p><ArrowUpRight size={14}/>{hint}</p></article>)}</div>
    <div className="dashboard-grid"><section className="surface-card span-two"><div className="card-header"><div><h3>Recent transactions</h3><p>Latest posted entries for this client</p></div><Link href="/journals" className="button-secondary">View journal entries</Link></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Accounting date</th><th>Description</th><th>Status</th><th className="numeric">Amount (BND)</th></tr></thead><tbody>{journals.map((journal)=><tr key={journal.id}><td><Link className="record-link" href={`/journals/${journal.id}`}>{journal.reference}</Link></td><td>{journal.accountingDate.toLocaleDateString("en-BN")}</td><td>{journal.description}</td><td><span className={`status-badge ${journal.status.toLowerCase()}`}>{journal.status}</span></td><td className="numeric money">{money(journal.lines.reduce((sum,line)=>sum+Number(line.debit),0))}</td></tr>)}{!journals.length&&<tr><td colSpan={5}><div className="table-empty">No posted transactions yet.</div></td></tr>}</tbody><tfoot><tr><td colSpan={4}>Displayed total</td><td className="numeric">{money(journals.reduce((total,journal)=>total+journal.lines.reduce((sum,line)=>sum+Number(line.debit),0),0))}</td></tr></tfoot></table></div></section>
      <aside className="surface-card"><div className="card-header"><div><h3>Accounting status</h3><p>Controls and outstanding work</p></div></div><div className="status-list"><div><span className="status-icon success"><Banknote size={18}/></span><div><strong>Ledger balanced</strong><small>Posted debits equal credits</small></div></div><div><span className="status-icon warning"><CalendarClock size={18}/></span><div><strong>{openPeriod?"Period open":"Period attention"}</strong><small>{openPeriod?.name??"Configure an open period"}</small></div></div><div><span className="status-icon warning"><AlertTriangle size={18}/></span><div><strong>Reconciliation pending</strong><small>Banking module planned</small></div></div></div><Link href="/journals/new" className="button-primary full-button">Post a journal</Link></aside>
    </div>
  </AppShell>;
}
