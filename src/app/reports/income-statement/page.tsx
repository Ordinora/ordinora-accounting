import Link from "next/link";
import { Download } from "lucide-react";
import { Prisma } from "@prisma/client";
import { AppShell } from "@/components/app-shell";
import { ledgerBalances } from "@/lib/reports";
import { requireActiveTenant } from "@/lib/session";
import { publishReport } from "../publish-actions";

export const dynamic = "force-dynamic";
const zero = new Prisma.Decimal(0);
const money = (code: string, value: Prisma.Decimal) => `${code} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const parsed = (value: string | undefined, fallback: Date) => { if (!value) return fallback; const date = new Date(`${value}T00:00:00.000Z`); return Number.isNaN(date.getTime()) ? fallback : date; };
const displayed = (date: Date) => date.toLocaleDateString("en-BN", { timeZone: "UTC" });

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams, { user, tenants, active } = await requireActiveTenant(), now = new Date();
  const from = parsed(query.from, new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to = parsed(query.to, now);
  const rows = await ledgerBalances(active.id, from, to), income = rows.filter(row => row.type === "REVENUE"), expenses = rows.filter(row => row.type === "EXPENSE");
  const revenue = income.reduce((sum, row) => sum.add(row.credit.sub(row.debit)), zero), expense = expenses.reduce((sum, row) => sum.add(row.debit.sub(row.credit)), zero), netProfit = revenue.sub(expense);
  const details = [...income.map(row => [row.name, row.classification, row.credit.sub(row.debit)] as const), ...expenses.map(row => [row.name, row.classification, row.debit.sub(row.credit)] as const)];
  const range = `from=${from.toISOString().slice(0,10)}&to=${to.toISOString().slice(0,10)}`;
  return <AppShell user={{displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name}} tenants={tenants} activeTenant={active} pageTitle="Income Statement" pageDescription="Income, expenses, and profit from posted accounting entries"><main className="module-page"><div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div><header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Income Statement</h2><p>For the period {displayed(from)} to {displayed(to)} · Accrual accounting</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0,10)}/></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0,10)}/></label><button className="button-secondary">Update</button></form><Link className="button-secondary report-pdf-button" href={`/reports/income-statement/pdf?${range}`}><Download size={17}/>Export PDF</Link><form action={publishReport}><input type="hidden" name="type" value="income-statement"/><input type="hidden" name="from" value={from.toISOString()}/><input type="hidden" name="asOf" value={to.toISOString()}/><button className="button-primary">Publish to portal</button></form></div></header><div className="form-notice"><span>Income and expenses are recognised when posted. Use the Cash Flow Statement to review actual money received and paid.</span></div><div className="summary-grid"><div><small>Total income</small><strong>{money(active.defaultCurrency,revenue)}</strong></div><div><small>Total expenses</small><strong>{money(active.defaultCurrency,expense)}</strong></div><div><small>Net profit / (loss)</small><strong>{money(active.defaultCurrency,netProfit)}</strong></div><div><small>Accounting method</small><strong>ACCRUAL</strong></div></div><section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Classification</th><th className="numeric">Amount</th></tr></thead><tbody>{details.map(([name,classification,amount])=><tr key={`${name}-${classification}`}><td>{name}</td><td>{classification}</td><td className="numeric">{money(active.defaultCurrency,amount)}</td></tr>)}{!details.length&&<tr><td colSpan={3} className="table-empty">No posted income or expenses in this period.</td></tr>}</tbody></table></div></section></main></AppShell>;
}
