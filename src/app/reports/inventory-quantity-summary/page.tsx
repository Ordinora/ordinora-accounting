import Link from "next/link";
import { Download } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { inventoryQuantityMovementSummary } from "@/lib/inventory-analysis";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
const date = (value: string | undefined, fallback: Date) => { const parsed = value ? new Date(`${value}T00:00:00.000Z`) : fallback; return Number.isNaN(parsed.getTime()) ? fallback : parsed; };
const shown = (value: Date) => value.toLocaleDateString("en-GB", { timeZone: "UTC" });
const money = (currency: string, value: { toString(): string }) => `${currency} ${Number(value.toString()).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; asOf?: string }> }) {
  const query = await searchParams, { user, tenants, active } = await requireActiveTenant(), to = date(query.to??query.asOf, new Date()), from = date(query.from, new Date(Date.UTC(to.getUTCFullYear(),to.getUTCMonth(),1))), rows = await inventoryQuantityMovementSummary(active.id, from, to), fromKey=from.toISOString().slice(0,10),toKey = to.toISOString().slice(0, 10), key = `from=${fromKey}&to=${toKey}`;
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Inventory Quantity Summary" pageDescription="Stock quantity, locations, average cost, and value by item">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/reports" className="back-link">← Report library</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Inventory Quantity Summary</h2><p>{shown(from)} to {shown(to)} · Opening, movement, and closing stock by item.</p></div><div className="report-actions"><form className="report-filter"><label>From<input name="from" type="date" defaultValue={fromKey}/></label><label>To<input name="to" type="date" defaultValue={toKey}/></label><button className="button-secondary">Update</button></form><Link className="button-secondary" href={`/reports/inventory-quantity-summary/pdf?${key}`}><Download size={16} />Export PDF</Link></div></header>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>SKU</th><th>Item</th><th>Unit</th><th className="numeric">Opening</th><th className="numeric">Qty in</th><th className="numeric">Qty out</th><th className="numeric">Closing</th><th className="numeric">Average cost</th><th className="numeric">Closing value</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link className="record-link" href={`/inventory/items/${row.id}?asOf=${toKey}`}>{row.sku}</Link></td><td><Link className="record-link" href={`/inventory/items/${row.id}?asOf=${toKey}`}>{row.name}</Link></td><td>{row.unit}</td><td className="numeric">{Number(row.openingQuantity).toLocaleString("en-US",{maximumFractionDigits:4})}</td><td className="numeric">{Number(row.quantityIn).toLocaleString("en-US",{maximumFractionDigits:4})}</td><td className="numeric">{Number(row.quantityOut).toLocaleString("en-US",{maximumFractionDigits:4})}</td><td className="numeric"><strong>{Number(row.closingQuantity).toLocaleString("en-US", { maximumFractionDigits: 4 })}</strong></td><td className="numeric">{money(active.defaultCurrency, row.averageCost)}</td><td className="numeric"><strong>{money(active.defaultCurrency, row.closingValue)}</strong></td></tr>)}{!rows.length && <tr><td colSpan={9}>No inventory activity in this period.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
