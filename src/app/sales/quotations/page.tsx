import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function SalesQuotationsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const quotations = await db.salesQuotation.findMany({ where: { tenantId: active.id }, include: { customer: true, convertedInvoice: true }, orderBy: [{ quoteDate: "desc" }, { createdAt: "desc" }] });
  const today = new Date();
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") || "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Sales Quotations" pageDescription="Customer offers that do not affect the ledger"><main className="module-page"><header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Sales quotations</h2><p>Draft, send, accept, and convert offers without posting accounting entries early.</p></div><Link href="/sales/quotations/new" className="button-primary"><Plus size={16} />New quotation</Link></header><section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Customer</th><th>Date</th><th>Valid until</th><th>Status</th><th className="numeric">Total</th><th>Converted invoice</th><th /></tr></thead><tbody>{quotations.map((quotation) => { const effectiveStatus = quotation.status === "SENT" && quotation.validUntil < today ? "EXPIRED" : quotation.status; return <tr key={quotation.id}><td><Link className="record-link" href={`/sales/quotations/${quotation.id}`}>{quotation.reference}</Link></td><td>{quotation.customer.name}</td><td>{quotation.quoteDate.toLocaleDateString("en-BN")}</td><td>{quotation.validUntil.toLocaleDateString("en-BN")}</td><td><span className={`status-badge ${effectiveStatus.toLowerCase()}`}>{effectiveStatus}</span></td><td className="numeric">{quotation.currency} {Number(quotation.foreignTotal).toFixed(2)}</td><td>{quotation.convertedInvoice ? <Link className="record-link" href={`/sales/${quotation.convertedInvoice.id}/edit`}>{quotation.convertedInvoice.reference}</Link> : "—"}</td><td><Link className="table-action" href={`/sales/quotations/${quotation.id}`}>View</Link></td></tr>; })}{!quotations.length && <tr><td className="table-empty" colSpan={8}>No sales quotations yet.</td></tr>}</tbody></table></div></section></main></AppShell>;
}
