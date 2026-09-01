import Link from "next/link";
import { FileCheck2, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SourceRecordActions } from "@/components/source-record-actions";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const [direct, supplier] = await Promise.all([
    db.payment.findMany({ where: { tenantId: active.id }, include: { bankAccount: true, lines: { include: { account: true } } }, orderBy: { paymentDate: "desc" } }),
    db.supplierPayment.findMany({ where: { tenantId: active.id }, include: { supplier: true, bankAccount: true, allocations: true }, orderBy: { paymentDate: "desc" } }),
  ]);
  const paymentAssetLineIds = direct.flatMap((payment) => payment.lines.filter((line) => line.account.type === "ASSET" && !line.inventoryItemId).map((line) => line.id));
  const registered = paymentAssetLineIds.length ? await db.fixedAsset.findMany({ where: { tenantId: active.id, OR: [{ sourceLineId: { in: paymentAssetLineIds } }, { sourceLineId: null }] }, select: { id: true, sourceLineId: true, assetAccountId: true, acquiredOn: true, originalCost: true } }) : [];
  const registeredIds = new Set(registered.map((asset) => asset.sourceLineId));
  const manuallyRegistered = new Set<string>();
  const usedManualAssets = new Set<string>();
  for (const payment of direct) for (const line of payment.lines) {
    if (line.account.type !== "ASSET" || line.inventoryItemId || registeredIds.has(line.id)) continue;
    const matches = registered.filter((asset) => !asset.sourceLineId && !usedManualAssets.has(asset.id) && asset.assetAccountId === line.accountId && asset.acquiredOn.getTime() === payment.paymentDate.getTime() && Math.abs(Number(asset.originalCost) - Number(line.baseAmount)) < 0.005);
    if (matches.length === 1) { manuallyRegistered.add(line.id); usedManualAssets.add(matches[0].id); }
  }
  const rows = [
    ...direct.map((payment) => {
      const assetLines = payment.lines.filter((line) => line.account.type === "ASSET" && !line.inventoryItemId);
      const unregistered = assetLines.filter((line) => !registeredIds.has(line.id) && !manuallyRegistered.has(line.id));
      return {
        id: `direct-${payment.id}`, reference: payment.reference, payee: payment.payee, date: payment.paymentDate, paidFrom: payment.bankAccount.name,
        currency: payment.currency, amount: payment.foreignAmount, type: payment.lines.length === 1 ? "Direct payment" : `Direct payment · ${payment.lines.length} lines`,
        editHref: `/payments/direct/${payment.id}/edit`, journalId: payment.journalId,
        paymentMethod: payment.paymentMethod ?? "BANK_TRANSFER", chequeNumber: payment.chequeNumber, chequeStatus: payment.chequeStatus,
        chequeAction: payment.paymentMethod === "BANK_CHEQUE" ? { href: `/payments/cheques/direct/${payment.id}`, label: payment.chequeStatus === "RETURNED" ? "View returned cheque" : "Manage cheque" } : undefined,
        fixedAssetAction: assetLines.length ? { href: `/payments/direct/${payment.id}/fixed-assets`, label: unregistered.length ? "Register fixed asset" : "View registered assets" } : undefined,
      };
    }),
    ...supplier.map((payment) => ({
      id: `supplier-${payment.id}`, reference: payment.reference, payee: payment.supplier.name, date: payment.paymentDate, paidFrom: payment.bankAccount.name,
      currency: payment.currency, amount: payment.foreignAmount, type: `Supplier settlement · ${payment.allocations.length} bill${payment.allocations.length === 1 ? "" : "s"}${payment.discountForeignAmount.gt(0) ? ` · discount ${payment.currency} ${Number(payment.discountForeignAmount).toFixed(2)}` : ""}`,
      editHref: `/payments/supplier/${payment.id}/edit`, journalId: payment.journalId, fixedAssetAction: undefined,
      paymentMethod: payment.paymentMethod ?? "BANK_TRANSFER", chequeNumber: payment.chequeNumber, chequeStatus: payment.chequeStatus,
      chequeAction: payment.paymentMethod === "BANK_CHEQUE" ? { href: `/payments/cheques/supplier/${payment.id}`, label: payment.chequeStatus === "RETURNED" ? "View returned cheque" : "Manage cheque" } : undefined,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Payments" pageDescription="All money paid from cash and bank accounts">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Payments</h2><p>Record direct payments or settle outstanding supplier invoices.</p></div><div className="workflow-actions"><Link href="/payments/new/supplier" className="button-secondary"><FileCheck2 size={16}/>Pay supplier invoice</Link><Link href="/payments/new" className="button-primary"><Plus size={16}/>New payment</Link></div></header>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Payee</th><th>Date</th><th>Paid from</th><th>Method</th><th>Type</th><th className="numeric">Amount</th><th aria-label="Options"></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.reference}</strong></td><td>{row.payee}</td><td>{row.date.toLocaleDateString("en-BN")}</td><td>{row.paidFrom}</td><td>{row.paymentMethod === "BANK_CHEQUE" ? <><strong>Cheque {row.chequeNumber}</strong><br/><span className="status-pill">{row.chequeStatus}</span></> : row.paymentMethod.replaceAll("_", " ")}</td><td>{row.type}</td><td className="numeric">{row.currency} {Number(row.amount).toFixed(2)}</td><td><SourceRecordActions editHref={row.editHref} journalId={row.journalId} fixedAssetAction={row.fixedAssetAction} chequeAction={row.chequeAction}/></td></tr>)}{!rows.length && <tr><td colSpan={8} className="table-empty">No payments have been recorded.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
