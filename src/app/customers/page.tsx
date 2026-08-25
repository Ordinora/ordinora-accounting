import { AppShell } from "@/components/app-shell";
import { ContactActions } from "@/components/contact-actions";
import { ContactCreateForm } from "@/components/contact-create-form";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { createCustomer } from "../contacts/actions";

export const dynamic = "force-dynamic";
export default async function CustomersPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const customers = await db.customer.findMany({ where: { tenantId: active.id }, orderBy: { name: "asc" } });
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Customers" pageDescription="Customer records, terms and receivable activity"><main className="module-page"><div className="split-layout"><section className="surface-card table-card"><div className="card-header"><div><h3>Customer directory</h3><p>{customers.length} active and inactive records</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Terms</th><th>Status</th><th aria-label="Options"></th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.code}</strong></td><td>{customer.name}</td><td>{customer.email ?? "—"}</td><td>{customer.paymentTermsDays} days</td><td><span className={`status-badge ${customer.isActive ? "active" : "inactive"}`}>{customer.isActive ? "ACTIVE" : "INACTIVE"}</span></td><td><ContactActions kind="customer" id={customer.id} /></td></tr>)}{!customers.length && <tr><td colSpan={6}><div className="table-empty">No customers yet.</div></td></tr>}</tbody></table></div></section><ContactCreateForm kind="customer" action={createCustomer} /></div></main></AppShell>;
}
