import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { calculateFixedAssetBookValue } from "@/lib/fixed-assets";
import { requireActiveTenant } from "@/lib/session";
import { postDepreciationRun } from "./actions";

export const dynamic = "force-dynamic";
const money = (currency: string, amount: number) => `${currency} ${amount.toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function Page({ searchParams }: { searchParams: Promise<{ asOf?: string; success?: string; error?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  const asOf = query.asOf ? new Date(`${query.asOf}T00:00:00`) : new Date();
  const [assets, history] = await Promise.all([
    db.fixedAsset.findMany({ where: { tenantId: active.id, status: "ACTIVE", acquiredOn: { lte: asOf } }, include: { depreciationEntries: { where: { depreciationDate: { lte: asOf } }, orderBy: { depreciationDate: "asc" } } }, orderBy: { assetCode: "asc" } }),
    db.fixedAssetDepreciation.findMany({ where: { tenantId: active.id }, include: { fixedAsset: true }, orderBy: { depreciationDate: "desc" }, take: 20 }),
  ]);
  const rows = assets.map((asset) => {
    const calc = calculateFixedAssetBookValue({ originalCost: Number(asset.originalCost), residualValue: Number(asset.residualValue), openingAccumulatedDepreciation: Number(asset.openingAccumulatedDepreciation), usefulLifeMonths: asset.usefulLifeMonths, depreciationStartsOn: asset.depreciationStartsOn, asOf });
    const posted = asset.depreciationEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    return { ...asset, calc, posted, due: Math.max(0, calc.accumulatedDepreciation - Number(asset.openingAccumulatedDepreciation) - posted) };
  });
  const totalDue = rows.reduce((sum, row) => sum + row.due, 0);

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Depreciation Run" pageDescription="Review and post straight-line book depreciation">
    <main className="module-page">
      <div className="detail-toolbar"><Link href="/fixed-assets" className="back-link">← Fixed assets</Link></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Book-depreciation run</h2><p>Only the unposted amount due through the selected date will be posted.</p></div></header>
      {query.success && <div className="form-notice"><strong>Completed</strong><span>{query.success}</span></div>}
      {query.error && <div className="form-error" role="alert">{query.error}</div>}
      <section className="surface-card form-panel"><form action={postDepreciationRun}><div className="form-grid"><label>Depreciation date<input name="depreciationDate" type="date" required defaultValue={asOf.toISOString().slice(0, 10)} /></label></div><div className="form-notice"><strong>Date-based posting</strong><span>The depreciation date selects the open accounting period automatically.</span></div><div className="form-actions"><button className="button-primary" disabled={totalDue <= 0}>Post {money(active.defaultCurrency, totalDue)}</button></div></form></section>
      <section className="metric-grid"><article className="metric-card"><span>Assets reviewed</span><strong>{rows.length}</strong></article><article className="metric-card"><span>Depreciation due</span><strong>{money(active.defaultCurrency,totalDue)}</strong></article><article className="metric-card"><span>Already current</span><strong>{rows.filter(row=>row.due<=0.005).length}</strong></article><article className="metric-card"><span>Assets to post</span><strong>{rows.filter(row=>row.due>0.005).length}</strong></article></section>
      <section className="surface-card table-card"><div className="card-heading"><div><h3>Depreciation preview</h3><p>Review every asset before posting. A zero amount means it is already current through this date.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th className="numeric">Monthly</th><th className="numeric">Opening accumulated</th><th className="numeric">Previously posted</th><th className="numeric">Due now</th><th className="numeric">Book value</th><th>Status</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.assetCode}</strong> — {row.name}</td><td className="numeric">{money(active.defaultCurrency, row.calc.monthlyDepreciation)}</td><td className="numeric">{money(active.defaultCurrency, Number(row.openingAccumulatedDepreciation))}</td><td className="numeric">{money(active.defaultCurrency, row.posted)}</td><td className="numeric">{money(active.defaultCurrency, row.due)}</td><td className="numeric">{money(active.defaultCurrency, row.calc.bookValue)}</td><td><span className={`status-badge ${row.due>0.005?"warning":"active"}`}>{row.due>0.005?"DUE":"CURRENT"}</span></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="table-empty">No active assets were acquired by this date.</td></tr>}</tbody></table></div></section>
      <section className="surface-card table-card"><div className="card-heading"><h3>Recent postings</h3></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Asset</th><th className="numeric">Amount</th><th>Journal</th></tr></thead><tbody>{history.map((entry) => <tr key={entry.id}><td>{entry.depreciationDate.toLocaleDateString("en-BN")}</td><td>{entry.fixedAsset.assetCode} — {entry.fixedAsset.name}</td><td className="numeric">{money(active.defaultCurrency, Number(entry.amount))}</td><td><Link className="record-link" href={`/journals/${entry.journalId}`}>View</Link></td></tr>)}{!history.length && <tr><td colSpan={4} className="table-empty">No depreciation has been posted.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
