import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { calculateFixedAssetBookValue } from "@/lib/fixed-assets";
import { postFixedAssetDisposal } from "../actions";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string; asset?: string }> }) {
  const query = await searchParams;
  const { user, tenants, active } = await requireActiveTenant();
  const today = new Date();
  const [assets, accounts] = await Promise.all([
    db.fixedAsset.findMany({ where: { tenantId: active.id, status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] }, disposal: null }, include:{depreciationEntries:true}, orderBy: { assetCode: "asc" } }),
    db.account.findMany({ where: { tenantId: active.id, isActive: true }, orderBy: { code: "asc" } }),
  ]);
  const assetAccounts = accounts.filter((account) => account.type === "ASSET");
  const revenueAccounts = accounts.filter((account) => account.type === "REVENUE");
  const expenseAccounts = accounts.filter((account) => account.type === "EXPENSE");
  const selected=assets.find(asset=>asset.id===query.asset),preview=selected?(()=>{const schedule=calculateFixedAssetBookValue({originalCost:Number(selected.originalCost),residualValue:Number(selected.residualValue),openingAccumulatedDepreciation:Number(selected.openingAccumulatedDepreciation),usefulLifeMonths:selected.usefulLifeMonths,depreciationStartsOn:selected.depreciationStartsOn,asOf:today}),posted=selected.depreciationEntries.reduce((sum,entry)=>sum+Number(entry.amount),0),accumulated=Number(selected.openingAccumulatedDepreciation)+posted;return{accumulated,bookValue:Math.max(0,Number(selected.originalCost)-accumulated),due:Math.max(0,schedule.accumulatedDepreciation-accumulated)}})():null;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="New Asset Disposal" pageDescription="Post proceeds and the resulting gain or loss">
    <main className="module-page form-page">
      <div className="detail-toolbar"><Link href="/fixed-assets/disposals" className="back-link">← Asset disposals</Link></div>
      {query.error && <div className="form-error" role="alert">{query.error}</div>}
      <div className="form-notice"><strong>Before posting</strong><span>Post depreciation through the disposal date first. The disposal uses accumulated depreciation already recorded in the asset register.</span></div>
      {selected&&preview&&<section className="metric-grid"><article className="metric-card"><span>Original cost</span><strong>{active.defaultCurrency} {Number(selected.originalCost).toFixed(2)}</strong></article><article className="metric-card"><span>Posted accumulated depreciation</span><strong>{active.defaultCurrency} {preview.accumulated.toFixed(2)}</strong></article><article className="metric-card"><span>Current book value</span><strong>{active.defaultCurrency} {preview.bookValue.toFixed(2)}</strong></article><article className="metric-card"><span>Depreciation due today</span><strong>{active.defaultCurrency} {preview.due.toFixed(2)}</strong></article></section>}
      <form action={postFixedAssetDisposal} className="surface-card form-panel">
        <section className="form-section">
          <div className="section-heading"><h2>Disposal details</h2><p>The system calculates net book value and gain or loss. The disposal date selects the open accounting period automatically.</p></div>
          <div className="form-grid">
            <label>Fixed asset<select name="fixedAssetId" required defaultValue={query.asset ?? ""}><option value="">Select asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.assetCode} — {asset.name} ({active.defaultCurrency} {Number(asset.originalCost).toFixed(2)})</option>)}</select><small>Select an asset, submit if necessary, and any accounting issue will return here without losing the selection.</small></label>
            <label>Disposal date<input name="disposalDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label>Proceeds received<input name="proceeds" type="number" min="0" step="0.01" defaultValue="0" required /></label>
            <label>Proceeds account<select name="proceedsAccountId" required><option value="">Select cash, bank, or receivable</option>{assetAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
            <label>Gain on disposal account<select name="gainAccountId"><option value="">Select if a gain applies</option>{revenueAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
            <label>Loss on disposal account<select name="lossAccountId"><option value="">Select if a loss applies</option>{expenseAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
            <label className="span-2">Reason / description<input name="reason" required minLength={5} maxLength={240} placeholder="Sold vehicle to..." /></label>
          </div>
        </section>
        <div className="form-actions"><Link href="/fixed-assets/disposals" className="button-secondary">Cancel</Link><button className="button-primary" disabled={!assets.length}>Post disposal</button></div>
      </form>
    </main>
  </AppShell>;
}
