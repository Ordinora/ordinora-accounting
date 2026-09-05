import Link from "next/link";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { bankingDateRange, calculateBankLedger } from "@/lib/banking-calculations";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

const money = (code: string, value: { toString(): string }) => code + " " + Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function BankingPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { user, tenants, active } = await requireActiveTenant();
  const range = bankingDateRange(await searchParams);
  const accounts = await db.account.findMany({
    where: { tenantId: active.id, type: "ASSET", reportingClassification: "Cash and cash equivalents" },
    include: {
      lines: {
        where: {
          journal: {
            tenantId: active.id,
            status: "POSTED",
            accountingDate: { lte: range.to },
          },
        },
        include: { journal: true },
      },
    },
    orderBy: { code: "asc" },
  });
  const summaries = accounts.map((account) => {
    const ledger = calculateBankLedger(account.lines.map((line) => ({
      id: line.id,
      debit: line.debit,
      credit: line.credit,
      accountingDate: line.journal.accountingDate,
    })), range);
    const lastActivity = ledger.rows.reduce<Date | null>((latest, line) => !latest || line.accountingDate > latest ? line.accountingDate : latest, null);
    return { account, ledger, lastActivity };
  });
  const total = summaries.reduce((sum, row) => sum + Number(row.ledger.balance), 0);
  const activeAccounts = summaries.filter((row) => row.account.isActive).length;
  const transactionCount = summaries.reduce((sum, row) => sum + row.ledger.rows.length, 0);
  const query = "from=" + range.fromInput + "&to=" + range.toInput;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Bank & Cash Accounts" pageDescription="Balances and activity across cash and bank ledgers">
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">{active.legalName.toUpperCase()}</p>
          <h2>Bank and cash workspace</h2>
          <p>Closing balances are shown as of {range.toInput}; movements cover {range.fromInput} to {range.toInput}.</p>
        </div>
        <div className="workflow-actions">
          <Link href="/receipts" className="button-secondary"><ArrowDownLeft size={16}/>Receipt</Link>
          <Link href="/payments/new" className="button-secondary"><ArrowUpRight size={16}/>Payment</Link>
          <Link href="/transfers/new" className="button-primary"><ArrowRightLeft size={16}/>Transfer</Link>
        </div>
      </header>
      <form className="report-filter dashboard-date-filter">
        <label>From<input name="from" type="date" defaultValue={range.fromInput}/></label>
        <label>To<input name="to" type="date" defaultValue={range.toInput}/></label>
        <button className="button-secondary">Apply dates</button>
        <Link href="/banking" className="button-secondary">Reset</Link>
      </form>
      <section className="kpi-grid">
        <article className="kpi-card"><span className="status-icon"><Landmark size={18}/></span><small>Combined closing balance</small><strong>{money(active.defaultCurrency, { toString: () => total.toString() })}</strong><p>As of {range.toInput}</p></article>
        <article className="kpi-card"><small>Active accounts</small><strong>{activeAccounts}</strong><p>Cash and bank ledgers</p></article>
        <article className="kpi-card"><small>Posted movements</small><strong>{transactionCount}</strong><p>{range.fromInput} to {range.toInput}</p></article>
      </section>
      <section className="surface-card table-card">
        <div className="card-header"><div><h3>Account balances</h3><p>Period movements and closing balances for every cash and bank account.</p></div></div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Account</th><th>Status</th><th>Last activity in period</th><th className="numeric">Period debits</th><th className="numeric">Period credits</th><th className="numeric">Balance as of {range.toInput}</th></tr></thead>
            <tbody>
              {summaries.map(({ account, ledger, lastActivity }) => <tr key={account.id}>
                <td><Link className="record-link" href={"/banking/" + account.id + "?" + query}><strong>{account.code}</strong> · {account.name}</Link></td>
                <td><span className={"status-badge " + (account.isActive ? "active" : "inactive")}>{account.isActive ? "ACTIVE" : "INACTIVE"}</span></td>
                <td>{lastActivity?.toLocaleDateString("en-BN") ?? "No activity in period"}</td>
                <td className="numeric">{money(active.defaultCurrency, ledger.totalDebits)}</td>
                <td className="numeric">{money(active.defaultCurrency, ledger.totalCredits)}</td>
                <td className="numeric"><strong>{money(active.defaultCurrency, ledger.balance)}</strong></td>
              </tr>)}
              {!summaries.length && <tr><td colSpan={6} className="table-empty">No bank or cash accounts exist for this client. Add an account classified as Cash and cash equivalents in the Chart of Accounts.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </AppShell>;
}
