import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProfitLossStatementView } from "@/components/profit-loss-statement";
import { calculateProfitLoss } from "@/lib/profit-loss";
import { ledgerBalances } from "@/lib/reports";
import { requireActiveTenant } from "@/lib/session";
import { publishReport } from "../publish-actions";
import { formatCurrencyAmount } from "@/lib/currency";

export const dynamic = "force-dynamic";
const money = formatCurrencyAmount;
const parsed = (value: string | undefined, fallback: Date) => { if (!value) return fallback; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? fallback : date; };
const displayed = (date: Date) => date.toLocaleDateString("en-BN", { timeZone: "UTC" });

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams, { user, tenants, active } = await requireActiveTenant(), now = new Date();
  const from = parsed(query.from, new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to = parsed(query.to, now);
  const statement = calculateProfitLoss(await ledgerBalances(active.id, from, to));
  const range = `from=${from.toISOString().slice(0,10)}&to=${to.toISOString().slice(0,10)}`;
  return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Income Statement" pageDescription="Income, expenses, and profit from posted accounting entries">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Income Statement</h2><p>For the period {displayed(from)} to {displayed(to)} · Accrual accounting</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0,10)}/></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0,10)}/></label><button className="button-secondary">Update</button></form><Link className="button-secondary report-pdf-button" href={`/reports/income-statement/pdf?${range}`}><Download size={17}/>Export PDF</Link><form action={publishReport}><input type="hidden" name="type" value="income-statement"/><input type="hidden" name="from" value={from.toISOString()}/><input type="hidden" name="asOf" value={to.toISOString()}/><button className="button-primary">Publish to portal</button></form></div></header>
      <div className="form-notice"><span>Income and expenses are recognised when posted. Use the Cash Flow Statement to review actual money received and paid.</span></div>
      <div className="summary-grid"><div><small>Net revenue</small><strong>{money(active.defaultCurrency,statement.netRevenue)}</strong></div><div><small>Gross profit</small><strong>{money(active.defaultCurrency,statement.grossProfit)}</strong></div><div><small>Operating income</small><strong>{money(active.defaultCurrency,statement.operatingIncome)}</strong></div><div><small>Net income</small><strong>{money(active.defaultCurrency,statement.netIncome)}</strong></div></div>
      <ProfitLossStatementView statement={statement} currency={active.defaultCurrency}/>
    </main>
  </AppShell>;
}
