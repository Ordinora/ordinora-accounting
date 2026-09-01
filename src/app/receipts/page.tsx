import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { SourceRecordActions } from "@/components/source-record-actions";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function ReceiptsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const rows = await db.customerReceipt.findMany({ where: { tenantId: active.id }, include: { customer: true, allocations: true, lines: true }, orderBy: { receiptDate: "desc" } });
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Receipts" pageDescription="Money received from customers and other payers">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Receipts</h2><p>Record invoice settlements or allocate other receipts directly to suitable ledger accounts.</p></div><Link href="/receipts/new" className="button-primary"><Plus size={16}/>New receipt</Link></header>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Paid by</th><th>Date</th><th>Currency</th><th>Details</th><th className="numeric">Cash received</th><th className="numeric">Base amount</th><th aria-label="Options"></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.reference}</strong></td><td>{row.customer?.name ?? row.payerName ?? "Other"}</td><td>{row.receiptDate.toLocaleDateString("en-BN")}</td><td>{row.currency}</td><td>{row.allocations.length ? `${row.allocations.length} invoice allocation${row.allocations.length === 1 ? "" : "s"}${row.discountForeignAmount.gt(0) ? ` · sales discount ${row.currency} ${Number(row.discountForeignAmount).toFixed(2)}` : ""}` : `${row.lines.length} line item${row.lines.length === 1 ? "" : "s"}`}</td><td className="numeric">{row.currency} {Number(row.foreignAmount).toFixed(2)}</td><td className="numeric">{active.defaultCurrency} {Number(row.baseAmount).toFixed(2)}</td><td><SourceRecordActions editHref={`/receipts/${row.id}/edit`} journalId={row.journalId}/></td></tr>)}{!rows.length && <tr><td colSpan={8}>No receipts yet.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
