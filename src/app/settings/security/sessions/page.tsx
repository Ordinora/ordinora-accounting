import { AppShell } from "@/components/app-shell";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { revokeSession } from "./actions";

export const dynamic = "force-dynamic";

export default async function ActiveSessionsPage() {
  const user = await requireStaff();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(user.staffRole)) redirect("/");
  const { tenants, active } = await getAuthorizedTenant(user);
  if (!active) throw new Error("No company is available.");
  const now = new Date();
  const sessions = await db.session.findMany({
    where: { revokedAt: null, expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - 30 * 60 * 1000) }, user: { firmId: user.firmId, isActive: true } },
    include: { user: { select: { displayName: true, email: true, kind: true, staffRole: true, clientRole: true, tenant: { select: { legalName: true } } } } },
    orderBy: { lastSeenAt: "desc" },
  });

  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole.replaceAll("_", " "), firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Active Sessions" pageDescription="Review and revoke staff or client access sessions">
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">SECURITY ADMINISTRATION</p><h2>Active sessions</h2><p>Sessions expire after 30 minutes without activity and always end after eight hours.</p></div></header>
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>User</th><th>Access</th><th>Company</th><th>Last activity</th><th>Absolute expiry</th><th>Revoke</th></tr></thead><tbody>
        {sessions.map((session) => <tr key={session.id}><td><strong>{session.user.displayName}</strong><small>{session.user.email}</small></td><td>{session.user.kind === "STAFF" ? session.user.staffRole?.replaceAll("_", " ") : session.user.clientRole?.replaceAll("_", " ")}</td><td>{session.user.kind === "CLIENT" ? session.user.tenant?.legalName ?? "—" : "Firm-wide staff"}</td><td>{session.lastSeenAt.toLocaleString("en-BN")}</td><td>{session.expiresAt.toLocaleString("en-BN")}</td><td><form action={revokeSession} className="table-inline-form"><input type="hidden" name="sessionId" value={session.id}/><input name="reason" required minLength={5} maxLength={240} placeholder="Reason" aria-label={`Reason to revoke ${session.user.displayName}`}/><button className="button-danger">Revoke</button></form></td></tr>)}
        {!sessions.length && <tr><td colSpan={6} className="table-empty">No active sessions.</td></tr>}
      </tbody></table></div></section>
    </main>
  </AppShell>;
}
