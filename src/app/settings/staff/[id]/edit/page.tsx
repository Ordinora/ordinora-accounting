import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, Save, UserRoundCheck, UserRoundX } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { db } from "@/lib/db";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { resetAccountingStaffPassword, setAccountingStaffStatus, updateAccountingStaff } from "../../actions";

export const dynamic = "force-dynamic";
const roleLabels = { ACCOUNTANT: "Accountant", PAYROLL_OFFICER: "Payroll officer", REVIEWER: "Reviewer", READ_ONLY: "Read only" } as const;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, administrator] = await Promise.all([params, searchParams, requireStaff()]);
  if (administrator.staffRole !== "SYSTEM_ADMIN") notFound();
  const [{ tenants, active }, member] = await Promise.all([
    getAuthorizedTenant(administrator),
    db.user.findFirst({ where: { id, firmId: administrator.firmId, kind: "STAFF" }, include: { assignments: true } }),
  ]);
  if (!member) notFound();
  const assigned = new Set(member.assignments.map((assignment) => assignment.tenantId));
  const isSystemAdministrator = member.staffRole === "SYSTEM_ADMIN";
  const isSelf = member.id === administrator.id;

  const content = <main className="module-page form-page">
    <div className="detail-toolbar"><Link href="/settings/staff" className="back-link">← Accounting staff</Link></div>
    {query.error && <div className="form-error" role="alert">{query.error}</div>}
    <form action={updateAccountingStaff} className="form-panel">
      <input type="hidden" name="staffId" value={member.id} />
      <section className="form-section"><div className="section-heading"><h2>Staff details</h2><p>Changes to identity, access role, and company assignments are recorded in the audit trail.</p></div><div className="form-grid">
        <label>Full name<input name="displayName" required minLength={2} maxLength={120} defaultValue={member.displayName} /></label>
        <label>Email<input name="email" type="email" required defaultValue={member.email} /></label>
        {isSystemAdministrator ? <label>Role<input value="SYSTEM ADMIN" readOnly /><input type="hidden" name="staffRole" value="SYSTEM_ADMIN" /></label> : <label>Role<select name="staffRole" required defaultValue={member.staffRole ?? "READ_ONLY"}>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        <label>MFA status<input value={member.mfaEnrolledAt && member.mfaSecretEncrypted ? "ENROLLED" : isSystemAdministrator ? "ENROLLMENT REQUIRED" : "NOT ENROLLED"} readOnly /></label>
        {isSystemAdministrator ? <div className="form-notice span-2"><strong>All-company access</strong><span>The System Administrator role and its firm-wide access cannot be delegated or removed here.</span></div> : <fieldset className="span-2"><legend>Assigned companies</legend><div className="portal-card-options">{tenants.map((tenant) => <label className="checkbox-label" key={tenant.id}><input type="checkbox" name="tenantId" value={tenant.id} defaultChecked={assigned.has(tenant.id)} /><span><strong>{tenant.legalName}</strong><small>{tenant.registrationNumber ?? "Client company"}</small></span></label>)}</div></fieldset>}
        <label className="span-2">Reason for update<input name="reason" required minLength={5} maxLength={240} placeholder="Explain why these staff details are changing" /></label>
      </div></section>
      <div className="form-actions"><Link href="/settings/staff" className="button-secondary">Cancel</Link><button className="button-primary"><Save size={15} />Save staff details</button></div>
    </form>

    <form id="account-status" action={setAccountingStaffStatus} className="form-panel">
      <input type="hidden" name="staffId" value={member.id} /><input type="hidden" name="nextActive" value={String(!member.isActive)} />
      <section className="form-section"><div className="section-heading"><h2>{member.isActive ? "Deactivate staff account" : "Reactivate staff account"}</h2><p>{member.isActive ? "Deactivation immediately revokes every active session and prevents future login." : "Reactivation restores password login using the staff member’s current password."}</p></div><div className="form-grid"><label className="span-2">Reason<input name="reason" required minLength={5} maxLength={240} placeholder={`Reason for ${member.isActive ? "deactivation" : "reactivation"}`} /></label></div>{isSelf && member.isActive && <div className="form-notice"><strong>Self-deactivation is blocked</strong><span>You cannot deactivate the account currently administering the firm.</span></div>}</section>
      <div className="form-actions"><button className={member.isActive ? "button-danger" : "button-primary"} disabled={isSelf && member.isActive}>{member.isActive ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}{member.isActive ? "Deactivate account" : "Reactivate account"}</button></div>
    </form>

    <form id="reset-password" action={resetAccountingStaffPassword} className="form-panel">
      <input type="hidden" name="staffId" value={member.id} />
      <section className="form-section"><div className="section-heading"><h2>Reset password</h2><p>Set a new password of at least 14 characters. All active sessions for this account will be revoked.</p></div><div className="form-grid"><label>New password<input name="password" type="password" required minLength={14} maxLength={200} autoComplete="new-password" /></label><label>Reason<input name="reason" required minLength={5} maxLength={240} /></label></div></section>
      <div className="form-actions"><button className="button-primary"><KeyRound size={15} />Reset password</button></div>
    </form>
  </main>;

  const shellUser = { displayName: administrator.displayName, email: administrator.email, role: administrator.staffRole.replaceAll("_", " "), firmName: administrator.firm.name };
  return active
    ? <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle={`Update ${member.displayName}`} pageDescription="Staff identity, access, status, and credentials">{content}</AppShell>
    : <FirmAdminShell user={shellUser} pageTitle={`Update ${member.displayName}`} pageDescription="Staff identity, access, status, and credentials">{content}</FirmAdminShell>;
}
