import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRightLeft, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { bankingDateRange, calculateBankLedger } from "@/lib/banking-calculations";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { journalDescriptionLabel, journalSourceLabel } from "@/lib/journal-labels";

export const dynamic = "force-dynamic";

const money = (code: string, value: { toString(): string }) => code + " " + Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function BankAccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const range = bankingDateRange(await searchParams);
  const account = await db.account.findFirst({
    where: { id, tenantId: active.id, type: "ASSET", reportingClassification: "Cash and cash equivalents" },
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
  });
  if (!account) notFound();
  const ledger = calculateBankLedger(account.lines.map((line) => ({
    id: line.id,
    debit: line.debit,
    credit: line.credit,
    accountingDate: line.journal.accountingDate,
  })), range);
  const lineById = new Map(account.lines.map((line) => [line.id, line]));
  const rows = [...ledger.rows].reverse().map((calculated) => ({ calculated, line: lineById.get(calculated.id)! }));
  const query = "from=" + range.fromInput + "&to=" + range.toInput;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={account.name} pageDescription="Posted account activity and running balance">
    <main className="module-page">
      <div className="detail-toolbar">
        <Link href={"/banking?" + query} className="back-link"><ArrowLeft size={15}/>Back to bank & cash accounts</Link>
        <span className={"status-badge large " + (account.isActive ? "active" : "inactive")}>{account.isActive ? "ACTIVE" : "INACTIVE"}</span>
      </div>
      <header className="module-header">
        <div>
          <p className="eyebrow">ACCOUNT {account.code}</p>
          <h2>{account.name}</h2>
          <p>Posted movements from {range.fromInput} to {range.toInput} in {active.defaultCurrency}.</p>
        </div>
        <div className="workflow-actions">
          <Link href="/payments/new" className="button-secondary"><ArrowUpRight size={16}/>New payment</Link>
          <Link href="/transfers/new" className="button-primary"><ArrowRightLeft size={16}/>New transfer</Link>
        </div>
      </header>
      <form className="report-filter dashboard-date-filter">
        <label>From<input name="from" type="date" defaultValue={range.fromInput}/></label>
        <label>To<input name="to" type="date" defaultValue={range.toInput}/></label>
        <button className="button-secondary">Apply dates</button>
        <Link href={"/banking/" + account.id} className="button-secondary">Reset</Link>
      </form>
      <section className="summary-grid">
        <div><small>Opening balance</small><strong>{money(active.defaultCurrency, ledger.openingBalance)}</strong></div>
        <div><small>Period debits</small><strong>{money(active.defaultCurrency, ledger.totalDebits)}</strong></div>
        <div><small>Period credits</small><strong>{money(active.defaultCurrency, ledger.totalCredits)}</strong></div>
        <div><small>Closing balance as of {range.toInput}</small><strong>{money(active.defaultCurrency, ledger.balance)}</strong></div>
      </section>
      <section className="surface-card table-card">
        <div className="card-header">
          <div>
            <h3>Account transactions</h3>
            <p>{rows.length} posted movements in the selected period. Running balances include the opening balance.</p>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Reference</th><th>Source</th><th>Description</th><th className="numeric">Debit</th><th className="numeric">Credit</th><th className="numeric">Running balance</th></tr></thead>
            <tbody>
              {rows.map(({ line, calculated }) => <tr key={line.id}>
                <td>{line.journal.accountingDate.toLocaleDateString("en-BN")}</td>
                <td><Link href={"/journals/" + line.journal.id} className="record-link">{line.journal.reference}</Link></td>
                <td>{journalSourceLabel(line.journal.source)}</td>
                <td>{line.description || journalDescriptionLabel(line.journal.source, line.journal.description)}</td>
                <td className="numeric">{Number(line.debit) ? money(active.defaultCurrency, line.debit) : "—"}</td>
                <td className="numeric">{Number(line.credit) ? money(active.defaultCurrency, line.credit) : "—"}</td>
                <td className="numeric"><strong>{money(active.defaultCurrency, calculated.runningBalance)}</strong>{line.currencyCode && line.currencyCode !== active.defaultCurrency && <small style={{ display: "block" }}>{line.currencyCode} {Number(line.foreignDebit?.sub(line.foreignCredit ?? 0) ?? 0).toFixed(2)}</small>}</td>
              </tr>)}
              {!rows.length && <tr><td colSpan={7} className="table-empty">No posted transactions exist in this date range.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </AppShell>;
}
