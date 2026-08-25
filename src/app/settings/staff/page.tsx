import { AppShell } from "@/components/app-shell";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { db } from "@/lib/db";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { createAccountingStaff } from "./actions";

export const dynamic = "force-dynamic";

const roleLabels = {
  ACCOUNTANT: "Accountant — accounting transactions and reports",
  PAYROLL_OFFICER: "Payroll officer — payroll operations",
  REVIEWER: "Reviewer — review and approval access",
  READ_ONLY: "Read only — view assigned companies",
} as const;

export default async function StaffSettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const user = await requireStaff();
  if (user.staffRole !== "SYSTEM_ADMIN") return <main className="login-page"><section className="login-card"><h1>System Administrator access required</h1><p>Only the System Administrator can create and assign accounting staff.</p></section></main>;

  const [{ tenants, active }, staff, query] = await Promise.all([
    getAuthorizedTenant(user),
    db.user.findMany({
      where: { firmId: user.firmId, kind: "STAFF" },
      include: { assignments: { include: { tenant: true } } },
      orderBy: [{ staffRole: "asc" }, { displayName: "asc" }],
    }),
    searchParams,
  ]);

  const content = <main className="module-page form-page">
    <header className="module-header"><div><p className="eyebrow">SYSTEM ADMINISTRATION</p><h2>Accounting staff</h2><p>Create operational users and grant access only to the companies they work on.</p></div></header>
    {query.error && <div className="form-error" role="alert">{query.error}</div>}
    {query.success && <div className="form-notice"><strong>{query.success}</strong></div>}
    <form action={createAccountingStaff} className="form-panel">
      <section className="form-section"><div className="section-heading"><h2>New staff account</h2><p>System Administrator access cannot be delegated from this form.</p></div>
        <div className="form-grid">
          <label>Full name<input name="displayName" required minLength={2} maxLength={120}/></label>
          <label>Email<input name="email" type="email" required autoComplete="off"/></label>
          <label>Temporary password<input name="password" type="password" required minLength={14} autoComplete="new-password"/></label>
          <label>Role<select name="staffRole" required>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <fieldset className="span-2"><legend>Assigned companies</legend><div className="portal-card-options">{tenants.map((tenant) => <label className="checkbox-label" key={tenant.id}><input type="checkbox" name="tenantId" value={tenant.id}/><span><strong>{tenant.legalName}</strong><small>{tenant.registrationNumber ?? "Client company"}</small></span></label>)}</div></fieldset>
        </div>
      </section>
      <div className="form-actions"><button className="button-primary" disabled={!tenants.length}>Create accounting staff</button></div>
    </form>
    <section className="surface-card table-card"><div className="card-header"><div><h3>Staff register</h3><p>The System Administrator has all-company access; other staff see only assigned companies.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Assigned companies</th><th>Status</th></tr></thead><tbody>{staff.map((member) => <tr key={member.id}><td><strong>{member.displayName}</strong></td><td>{member.email}</td><td>{member.staffRole?.replaceAll("_", " ")}</td><td>{member.staffRole === "SYSTEM_ADMIN" ? "All companies" : member.assignments.map((assignment) => assignment.tenant.legalName).join(", ") || "None"}</td><td><span className={`status-badge ${member.isActive ? "active" : "inactive"}`}>{member.isActive ? "ACTIVE" : "INACTIVE"}</span></td></tr>)}</tbody></table></div></section>
  </main>;

  const shellUser = { displayName: user.displayName, email: user.email, role: user.staffRole.replaceAll("_", " "), firmName: user.firm.name };
  return active
    ? <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle="Accounting Staff" pageDescription="Role and company-access administration">{content}</AppShell>
    : <FirmAdminShell user={shellUser} pageTitle="Accounting Staff" pageDescription="Create staff after adding the first client company">{content}</FirmAdminShell>;
}
