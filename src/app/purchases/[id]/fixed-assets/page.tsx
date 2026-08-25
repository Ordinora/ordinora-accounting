import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SupplierBillFixedAssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, tenants, active } = await requireActiveTenant();
  const bill = await db.supplierBill.findFirst({
    where: { id, tenantId: active.id },
    include: {
      supplier: true,
      lines: { include: { expenseAccount: true, inventoryItem: true } },
    },
  });
  if (!bill) notFound();

  const registeredAssets = await db.fixedAsset.findMany({
    where: { tenantId: active.id, sourceLineId: { in: bill.lines.map((line) => line.id) } },
    select: { id: true, assetCode: true, name: true, sourceLineId: true },
  });
  const registeredByLine = new Map(registeredAssets.map((asset) => [asset.sourceLineId, asset]));
  const readyCount = bill.lines.filter((line) => line.expenseAccount.type === "ASSET" && !line.inventoryItemId && !registeredByLine.has(line.id)).length;

  return <AppShell
    user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }}
    tenants={tenants}
    activeTenant={active}
    pageTitle={`Register Assets from ${bill.reference}`}
    pageDescription="Create asset-register records from posted supplier-bill lines"
  >
    <main className="module-page">
      <div className="detail-toolbar"><Link href={`/purchases/${bill.id}/edit`} className="back-link">← Supplier bill</Link></div>
      <header className="module-header">
        <div>
          <p className="eyebrow">{bill.supplier.name.toUpperCase()}</p>
          <h2>Review purchase lines</h2>
          <p>Inventory and expense lines are shown for context. Only non-inventory lines posted to an asset account can be registered as fixed assets.</p>
        </div>
        <span className={`status-badge large ${readyCount ? "pending" : "complete"}`}>{readyCount ? `${readyCount} TO REGISTER` : "REVIEWED"}</span>
      </header>

      <div className="form-notice">
        <strong>No duplicate accounting entry</strong>
        <span>The supplier bill already posted the ledger. Registering an asset adds its depreciation and tracking details only.</span>
      </div>

      <section className="surface-card table-card">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Description</th><th>Purchase classification</th><th>Ledger account</th><th className="numeric">Qty</th><th className="numeric">Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {bill.lines.map((line) => {
                const registered = registeredByLine.get(line.id);
                const fixedAsset = line.expenseAccount.type === "ASSET" && !line.inventoryItemId;
                const classification = line.inventoryItem ? `Inventory · ${line.inventoryItem.name}` : fixedAsset ? "Fixed asset" : "Expense / other ledger line";
                return <tr key={line.id}>
                  <td><strong>{line.description}</strong></td>
                  <td>{classification}</td>
                  <td>{line.expenseAccount.code} — {line.expenseAccount.name}</td>
                  <td className="numeric">{Number(line.quantity).toLocaleString("en-BN")}</td>
                  <td className="numeric">{bill.currency} {Number(line.lineTotal).toLocaleString("en-BN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>{registered
                    ? <span className="status-badge complete"><CheckCircle2 size={12}/>REGISTERED</span>
                    : fixedAsset
                      ? <span className="status-badge pending">READY</span>
                      : <span className="status-badge">NOT APPLICABLE</span>}
                  </td>
                  <td>{registered
                    ? <Link className="record-link" href={`/fixed-assets/${registered.id}/edit`}>{registered.assetCode} · {registered.name}</Link>
                    : fixedAsset
                      ? <Link className="button-secondary" href={`/fixed-assets/new?sourceLineId=${line.id}`}><ArrowRight size={15}/>Register asset</Link>
                      : "—"}
                  </td>
                </tr>;
              })}
              {!bill.lines.length && <tr><td colSpan={7} className="table-empty">This supplier bill has no purchase lines.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </AppShell>;
}
