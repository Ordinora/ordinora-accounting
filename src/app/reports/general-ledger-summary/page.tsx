import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { generalLedgerReport } from "@/lib/general-ledger-report";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const parsed = (value: string | undefined, fallback: Date) => { const result = value ? new Date(`${value}T00:00:00.000Z`) : fallback; return Number.isNaN(result.getTime()) ? fallback : result; };
const shown = (value: Date) => value.toLocaleDateString("en-GB", { timeZone: "UTC" });
const money = (currency: string, value: { toString(): string }) => `${currency} ${Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const query = await searchParams, { user, tenants, active } = await requireActiveTenant(), now = new Date();
  const from = parsed(query.from, new Date(Date.UTC(now.getUTCFullYear(), 0, 1))), to = parsed(query.to, now), rows = await generalLedgerReport(active.id, from, to);
  const range = `from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`;
  return <AppShell user={{ displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="General Ledger Summary" pageDescription="Opening balances, period movement, and closing balances by account"><main className="module-page"><div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div><header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>General Ledger Summary</h2><p>{shown(from)} to {shown(to)} · Posted ledger entries</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={from.toISOString().slice(0,10)}/></label><label>To<input name="to" type="date" defaultValue={to.toISOString().slice(0,10)}/></label><button className="button-secondary">Update</button></form><Link className="button-secondary" href={`/reports/general-ledger-summary/pdf?${range}`}><Download size={16}/>Export PDF</Link></div></header><section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Account</th><th>Type</th><th className="numeric">Opening</th><th className="numeric">Debit</th><th className="numeric">Credit</th><th className="numeric">Closing</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.code}</td><td><Link className="record-link" href={`/reports/general-ledger-transactions?${range}&accountId=${row.id}`}>{row.name}</Link></td><td>{row.type}</td><td className="numeric">{money(active.defaultCurrency,row.opening)}</td><td className="numeric">{money(active.defaultCurrency,row.debit)}</td><td className="numeric">{money(active.defaultCurrency,row.credit)}</td><td className="numeric"><strong>{money(active.defaultCurrency,row.closing)}</strong></td></tr>)}{!rows.length&&<tr><td colSpan={7}>No posted ledger balances for this period.</td></tr>}</tbody></table></div></section></main></AppShell>;
}

