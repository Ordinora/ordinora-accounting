import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { generalLedgerReport } from "@/lib/general-ledger-report";
import { requireActiveTenant } from "@/lib/session";
import { journalSourceLabel } from "@/lib/journal-labels";

export const dynamic = "force-dynamic";
const parsed = (value: string | undefined, fallback: Date) => { const result = value ? new Date(`${value}T00:00:00.000Z`) : fallback; return Number.isNaN(result.getTime()) ? fallback : result; };
const shown = (value: Date) => value.toLocaleDateString("en-GB", { timeZone: "UTC" });
const money = (currency: string, value: { toString(): string }) => `${currency} ${Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; accountId?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  const now = new Date(), from = parsed(query.from, new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to = parsed(query.to, now);
  const accounts = await generalLedgerReport(active.id, from, to);
  const selectedId = accounts.some((row) => row.id === query.accountId) ? query.accountId : accounts[0]?.id;
  const rows = selectedId ? await generalLedgerReport(active.id, from, to, selectedId) : [], selected = rows[0];
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}${selectedId ? `&accountId=${selectedId}` : ""}`;
  const shellUser = { displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name };
  return <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle="General Ledger Transactions" pageDescription="Posted journal activity and running balance for one account">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div>
      <header className="module-header">
        <div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>General Ledger Transactions</h2><p>{shown(from)} to {shown(to)} · {selected ? `${selected.code} · ${selected.name}` : "No account activity"}</p></div>
        <div className="report-actions"><form className="report-filter">
          <label>Account<select name="accountId" defaultValue={selectedId}>{accounts.map((account) => <option value={account.id} key={account.id}>{account.code} · {account.name}</option>)}</select></label>
          <label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0, 10)}/></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0, 10)}/></label><button className="button-secondary">Update</button>
        </form>{selected && <Link className="button-secondary" href={`/reports/general-ledger-transactions/pdf?${range}`}><Download size={16}/>Export PDF</Link>}</div>
      </header>
      {selected && <div className="summary-grid"><div><small>Opening balance</small><strong>{money(active.defaultCurrency, selected.opening)}</strong></div><div><small>Period debits</small><strong>{money(active.defaultCurrency, selected.debit)}</strong></div><div><small>Period credits</small><strong>{money(active.defaultCurrency, selected.credit)}</strong></div><div><small>Closing balance</small><strong>{money(active.defaultCurrency, selected.closing)}</strong></div></div>}
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Reference</th><th>Description</th><th>Source</th><th className="numeric">Debit</th><th className="numeric">Credit</th><th className="numeric">Balance</th></tr></thead><tbody>
        {selected?.lines.map((line) => <tr key={line.id}><td>{shown(line.date)}</td><td><Link className="record-link" href={`/journals/${line.journalId}`}>{line.reference}</Link></td><td>{line.description}</td><td>{journalSourceLabel(line.source)}</td><td className="numeric">{line.debit.eq(0) ? "—" : money(active.defaultCurrency, line.debit)}</td><td className="numeric">{line.credit.eq(0) ? "—" : money(active.defaultCurrency, line.credit)}</td><td className="numeric"><strong>{money(active.defaultCurrency, line.balance)}</strong></td></tr>)}
        {!selected?.lines.length && <tr><td colSpan={7}>No posted transactions for this account and period.</td></tr>}
      </tbody></table></div></section>
    </main>
  </AppShell>;
}
