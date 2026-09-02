import { ShieldCheck, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClientUserForm } from "@/components/client-user-form";
import { ClientPasswordReset } from "@/components/client-password-reset";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { updateClientUser, updatePortalSettings } from "./actions";

export const dynamic = "force-dynamic";

const dashboardCards = [
  ["cash", "Cash and bank"],
  ["revenue", "Revenue"],
  ["receivables", "Accounts receivable"],
  ["payables", "Accounts payable"],
  ["profit", "Net profit"],
] as const;

export default async function PortalSettingsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const clientUsers = await db.user.findMany({
    where: { tenantId: active.id, kind: "CLIENT" },
    select: { id: true, displayName: true, email: true, clientRole: true, isActive: true },
    orderBy: { displayName: "asc" },
  });

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Client Portal" pageDescription="Controlled client access to company reports and documents">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Client portal controls</h2><p>Client access is isolated to this company and can be disabled immediately.</p></div><span className={`status-badge large ${active.portalEnabled ? "active" : "inactive"}`}>{active.portalEnabled ? "PORTAL ENABLED" : "PORTAL DISABLED"}</span></header>

      <form action={updatePortalSettings} className="surface-card form-panel">
        <section className="form-section"><div className="section-heading"><h2><ShieldCheck size={19}/> Access and report visibility</h2><p>Published-only is the safest starting mode. Live mode will expose posted figures only, never drafts.</p></div>
          <div className="portal-settings-grid">
            <label className="checkbox-label"><input name="portalEnabled" type="checkbox" defaultChecked={active.portalEnabled}/>Enable portal access for this company</label>
            <label>Report visibility<select name="reportMode" defaultValue={active.reportMode}><option value="PUBLISHED_ONLY">Published reports only</option><option value="LIVE_POSTED_AND_PUBLISHED">Live posted figures and published reports</option></select></label>
            <label className="checkbox-label"><input name="documentUploadEnabled" type="checkbox" defaultChecked={active.documentUploadEnabled}/>Allow client document uploads</label>
            <label className="checkbox-label"><input name="payrollVisibility" type="checkbox" defaultChecked={active.payrollVisibility}/>Allow payroll data for specifically authorized payroll users</label>
          </div>
        </section>
        <section className="form-section"><div className="section-heading"><h2>Client dashboard cards</h2><p>Select the posted financial summaries clients may see when live reporting is enabled.</p></div><div className="portal-card-options">{dashboardCards.map(([value, label]) => <label className="checkbox-label" key={value}><input name="enabledDashboardCards" type="checkbox" value={value} defaultChecked={active.enabledDashboardCards.includes(value)}/>{label}</label>)}</div></section>
        <div className="form-actions"><button className="button-primary">Save portal settings</button></div>
      </form>

      <section className="surface-card form-panel portal-users-card"><section className="form-section"><div className="section-heading"><h2><Users size={19}/> Add client user</h2><p>Create tenant-isolated access. The password is stored only as a secure hash.</p></div><ClientUserForm/></section></section>
      <section className="surface-card table-card portal-users-card"><div className="card-header"><div><h3><Users size={17}/> Client users</h3><p>Change access roles, deactivate access, or securely reset a client password.</p></div><span className="status-badge">{clientUsers.length} USERS</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role and status</th><th>Password</th></tr></thead><tbody>{clientUsers.map((client) => <tr key={client.id}><td><strong>{client.displayName}</strong></td><td>{client.email}</td><td><form action={updateClientUser.bind(null, client.id)} className="client-access-row"><select name="clientRole" defaultValue={client.clientRole ?? "CLIENT_FINANCE_VIEWER"}><option value="CLIENT_ADMIN">Client administrator</option><option value="CLIENT_DIRECTOR">Client director</option><option value="CLIENT_FINANCE_VIEWER">Finance viewer</option><option value="CLIENT_PAYROLL_VIEWER">Payroll viewer</option><option value="CLIENT_DOCUMENT_CONTRIBUTOR">Document contributor</option></select><label className="checkbox-label"><input name="isActive" type="checkbox" defaultChecked={client.isActive}/>Active</label><button className="button-secondary">Update</button></form></td><td><ClientPasswordReset userId={client.id} displayName={client.displayName}/></td></tr>)}{!clientUsers.length && <tr><td colSpan={4} className="table-empty">No client users have been added for this company.</td></tr>}</tbody></table></div></section>
    </main>
  </AppShell>;
}
