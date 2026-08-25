import Link from "next/link";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Landmark } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { calculateBankLedger } from "@/lib/banking-calculations";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const money = (code: string, value: { toString(): string }) => `${code} ${Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BankingPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const accounts = await db.account.findMany({
    where: { tenantId: active.id, type: "ASSET", reportingClassification: "Cash and cash equivalents" },
    include: { lines: { where: { journal: { tenantId: active.id, status: "POSTED" } }, include: { journal: true } } },
    orderBy: { code: "asc" },
  });
  const summaries = accounts.map((account) => {
    const ledger = calculateBankLedger(account.lines.map((line) => ({ id: line.id, debit: line.debit, credit: line.credit, accountingDate: line.journal.accountingDate })));
    const lastActivity = account.lines.reduce<Date | null>((latest, line) => !latest || line.journal.accountingDate > latest ? line.journal.accountingDate : latest, null);
    return { account, ledger, lastActivity };
  });
  const total = summaries.reduce((sum, row) => sum + Number(row.ledger.balance), 0);
  const activeAccounts = summaries.filter((row) => row.account.isActive).length;
  const transactionCount = summaries.reduce((sum, row) => sum + row.ledger.rows.length, 0);

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Bank & Cash Accounts" pageDescription="Balances and activity across cash and bank ledgers">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Bank and cash workspace</h2><p>Balances below come directly from posted journals in the base currency.</p></div><div className="workflow-actions"><Link href="/receipts" className="button-secondary"><ArrowDownLeft size={16}/>Receipt</Link><Link href="/payments/new" className="button-secondary"><ArrowUpRight size={16}/>Payment</Link><Link href="/transfers/new" className="button-primary"><ArrowRightLeft size={16}/>Transfer</Link></div></header>
      <section className="kpi-grid"><article className="kpi-card"><span className="status-icon"><Landmark size={18}/></span><small>Combined balance</small><strong>{money(active.defaultCurrency, { toString: () => total.toString() })}</strong></article><article className="kpi-card"><small>Active accounts</small><strong>{activeAccounts}</strong><p>Cash and bank ledgers</p></article><article className="kpi-card"><small>Posted movements</small><strong>{transactionCount}</strong><p>Across all account histories</p></article></section>
      <section className="surface-card table-card"><div className="card-header"><div><h3>Account balances</h3><p>Select an account to inspect its complete posted transaction history.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Status</th><th>Last activity</th><th className="numeric">Debits</th><th className="numeric">Credits</th><th className="numeric">Current balance</th></tr></thead><tbody>{summaries.map(({ account, ledger, lastActivity }) => <tr key={account.id}><td><Link className="record-link" href={`/banking/${account.id}`}><strong>{account.code}</strong> · {account.name}</Link></td><td><span className={`status-badge ${account.isActive ? "active" : "inactive"}`}>{account.isActive ? "ACTIVE" : "INACTIVE"}</span></td><td>{lastActivity?.toLocaleDateString("en-BN") ?? "No activity"}</td><td className="numeric">{money(active.defaultCurrency, ledger.totalDebits)}</td><td className="numeric">{money(active.defaultCurrency, ledger.totalCredits)}</td><td className="numeric"><strong>{money(active.defaultCurrency, ledger.balance)}</strong></td></tr>)}{!summaries.length && <tr><td colSpan={6} className="table-empty">No bank or cash accounts exist for this client. Add an account classified as Cash and cash equivalents in the Chart of Accounts.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
