import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { linkFixedAssetToPaymentLine } from "@/app/fixed-assets/actions";

export const dynamic = "force-dynamic";

export default async function PaymentFixedAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const payment = await db.payment.findFirst({ where: { id, tenantId: active.id }, include: { lines: { include: { account: true, inventoryItem: true } } } });
  if (!payment) notFound();
  const registered = await db.fixedAsset.findMany({ where: { tenantId: active.id, OR: [{ sourceLineId: { in: payment.lines.map((line) => line.id) } }, { sourceLineId: null }] }, select: { id: true, assetCode: true, name: true, sourceLineId: true, assetAccountId: true, acquiredOn: true, originalCost: true } });
  const registeredByLine = new Map(registered.map((asset) => [asset.sourceLineId, asset]));
  const usedManualAssets = new Set<string>();
  for (const line of payment.lines) {
    if (registeredByLine.has(line.id) || line.account.type !== "ASSET" || line.inventoryItemId) continue;
    const matches = registered.filter((asset) => !asset.sourceLineId && !usedManualAssets.has(asset.id) && asset.assetAccountId === line.accountId && asset.acquiredOn.getTime() === payment.paymentDate.getTime() && Math.abs(Number(asset.originalCost) - Number(line.baseAmount)) < 0.005);
    if (matches.length === 1) { registeredByLine.set(line.id, matches[0]); usedManualAssets.add(matches[0].id); }
  }
  const readyCount = payment.lines.filter((line) => line.account.type === "ASSET" && !line.inventoryItemId && !registeredByLine.has(line.id)).length;

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={`Assets from ${payment.reference}`} pageDescription="Review fixed-asset registration for direct-payment lines">
    <main className="module-page">
      <div className="detail-toolbar"><Link href={`/payments/direct/${payment.id}/edit`} className="back-link">← Payment</Link></div>
      <header className="module-header"><div><p className="eyebrow">{payment.payee.toUpperCase()}</p><h2>Review payment lines</h2><p>Only non-inventory lines posted to an asset account require fixed-asset registration.</p></div><span className={`status-badge large ${readyCount ? "pending" : "complete"}`}>{readyCount ? `${readyCount} TO REGISTER` : "REVIEWED"}</span></header>
      <div className="form-notice"><strong>No duplicate accounting entry</strong><span>The payment already posted the asset cost. Registration adds depreciation and tracking details only.</span></div>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table">
        <thead><tr><th>Description</th><th>Payment classification</th><th>Ledger account</th><th className="numeric">Qty</th><th className="numeric">Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>{payment.lines.map((line) => {
          const asset = registeredByLine.get(line.id);
          const fixedAsset = line.account.type === "ASSET" && !line.inventoryItemId;
          const classification = line.inventoryItem ? `Inventory · ${line.inventoryItem.name}` : fixedAsset ? "Fixed asset" : "Expense / other ledger line";
          return <tr key={line.id}><td><strong>{line.description}</strong></td><td>{classification}</td><td>{line.account.code} — {line.account.name}</td><td className="numeric">{Number(line.quantity).toLocaleString("en-BN")}</td><td className="numeric">{payment.currency} {Number(line.foreignAmount).toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>{asset ? <span className="status-badge complete"><CheckCircle2 size={12}/>REGISTERED</span> : fixedAsset ? <span className="status-badge pending">READY</span> : <span className="status-badge">NOT APPLICABLE</span>}</td><td>{asset ? <div className="source-link-actions"><Link className="record-link" href={`/fixed-assets/${asset.id}/edit`}>{asset.assetCode} · {asset.name}</Link>{!asset.sourceLineId&&<form action={linkFixedAssetToPaymentLine.bind(null,asset.id,line.id)}><button className="button-secondary">Link to payment</button></form>}</div> : fixedAsset ? <Link className="button-secondary" href={`/fixed-assets/new?paymentLineId=${line.id}`}><ArrowRight size={15}/>Register asset</Link> : "—"}</td></tr>;
        })}{!payment.lines.length && <tr><td colSpan={7} className="table-empty">This payment has no allocation lines.</td></tr>}</tbody>
      </table></div></section>
    </main>
  </AppShell>;
}
