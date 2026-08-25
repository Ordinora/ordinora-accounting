import { AppShell } from "@/components/app-shell";
import { ContactActions } from "@/components/contact-actions";
import { ContactCreateForm } from "@/components/contact-create-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { createSupplier } from "../contacts/actions";

export const dynamic = "force-dynamic";
export default async function SuppliersPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const suppliers = await db.supplier.findMany({ where: { tenantId: active.id }, orderBy: { name: "asc" } });
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Suppliers" pageDescription="Supplier records, terms and payable activity"><main className="module-page"><div className="split-layout"><section className="surface-card table-card"><div className="card-header"><div><h3>Supplier directory</h3><p>{suppliers.length} active and inactive records</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Terms</th><th>Status</th><th aria-label="Options"></th></tr></thead><tbody>{suppliers.map((supplier) => <tr key={supplier.id}><td><strong>{supplier.code}</strong></td><td>{supplier.name}</td><td>{supplier.email ?? "—"}</td><td>{supplier.paymentTermsDays} days</td><td><span className={`status-badge ${supplier.isActive ? "active" : "inactive"}`}>{supplier.isActive ? "ACTIVE" : "INACTIVE"}</span></td><td><ContactActions kind="supplier" id={supplier.id} /></td></tr>)}{!suppliers.length && <tr><td colSpan={6}><div className="table-empty">No suppliers yet.</div></td></tr>}</tbody></table></div></section><ContactCreateForm kind="supplier" action={createSupplier} /></div></main></AppShell>;
}
