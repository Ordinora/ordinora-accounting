import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { isSessionActive, SESSION_ABSOLUTE_LENGTH_MS, shouldTouchSession } from "./session-policy";
import { requiresStaffMfaEnrollment } from "./staff-mfa-policy";

const SESSION_COOKIE = "ordinora_session";
const ACTIVE_TENANT_COOKIE = "ordinora_tenant";

export const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_LENGTH_MS) } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_ABSOLUTE_LENGTH_MS / 1000 });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(SESSION_COOKIE);
  jar.delete(ACTIVE_TENANT_COOKIE);
}

export async function getCurrentStaff() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { firm: true, assignments: { include: { tenant: true } } } } } });
  const now = new Date();
  if (!session || !isSessionActive({ now, expiresAt: session.expiresAt, lastSeenAt: session.lastSeenAt, revokedAt: session.revokedAt }) || !session.user.isActive || session.user.kind !== "STAFF") {
    if (session && !session.revokedAt) await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    return null;
  }
  // Upgrade the single administrator created by older production bootstraps.
  // A delegated Firm Admin is never promoted when a System Admin already exists.
  if (session.user.staffRole === "FIRM_ADMIN") {
    const systemAdministrator = await db.user.findFirst({
      where: { firmId: session.user.firmId, kind: "STAFF", staffRole: "SYSTEM_ADMIN", isActive: true },
      select: { id: true },
    });
    if (!systemAdministrator) {
      await db.$transaction([
        db.user.update({ where: { id: session.user.id }, data: { staffRole: "SYSTEM_ADMIN" } }),
        db.auditEvent.create({
          data: {
            firmId: session.user.firmId,
            actorId: session.user.id,
            actorKind: "STAFF",
            action: "LEGACY_ADMIN_PROMOTED",
            entityType: "User",
            entityId: session.user.id,
            previousValues: { staffRole: "FIRM_ADMIN" },
            newValues: { staffRole: "SYSTEM_ADMIN" },
          },
        }),
      ]);
      session.user.staffRole = "SYSTEM_ADMIN";
    }
  }
  if (shouldTouchSession(session.lastSeenAt, now)) await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastSeenAt: now } });
  return session.user;
}

export async function getCurrentClient() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { firm: true, tenant: true } } } });
  const now = new Date();
  if (!session || !isSessionActive({ now, expiresAt: session.expiresAt, lastSeenAt: session.lastSeenAt, revokedAt: session.revokedAt }) || !session.user.isActive || session.user.kind !== "CLIENT") {
    if (session && !session.revokedAt) await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    return null;
  }
  if (!session.user.tenant || !session.user.tenant.portalEnabled || session.user.tenant.status !== "ACTIVE") {
    await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: now } });
    return null;
  }
  if (shouldTouchSession(session.lastSeenAt, now)) await db.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { lastSeenAt: now } });
  return session.user;
}

export async function requireClient() {
  const user = await getCurrentClient();
  if (!user) redirect("/portal/login");
  return user;
}

export function canClientViewFinancials(role: string | null) {
  return Boolean(role && ["CLIENT_ADMIN", "CLIENT_DIRECTOR", "CLIENT_FINANCE_VIEWER"].includes(role));
}

export async function requireClientFinancialAccess() {
  const user = await requireClient();
  if (!canClientViewFinancials(user.clientRole)) redirect("/portal");
  return user;
}

export async function requireStaff(options: { allowMfaEnrollment?: boolean } = {}) {
  const user = await getCurrentStaff();
  if (!user) redirect("/login");
  if (!options.allowMfaEnrollment && requiresStaffMfaEnrollment(user)) redirect("/settings/security/mfa");
  return user;
}

export async function getAuthorizedTenant(user: Awaited<ReturnType<typeof requireStaff>>) {
  const requestedId = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  const isAdmin = user.staffRole === "SYSTEM_ADMIN" || user.staffRole === "FIRM_ADMIN";
  const tenants = isAdmin
    ? await db.tenant.findMany({ where: { firmId: user.firmId }, orderBy: { legalName: "asc" } })
    : user.assignments.map((assignment) => assignment.tenant).sort((a, b) => a.legalName.localeCompare(b.legalName));
  const active = tenants.find((tenant) => tenant.id === requestedId) ?? tenants[0] ?? null;
  return { tenants, active };
}

export async function requireActiveTenant() {
  const user = await requireStaff();
  const { tenants, active } = await getAuthorizedTenant(user);
  if (!active) throw new Error("No authorized client is selected.");
  return { user, tenants, active };
}

export { ACTIVE_TENANT_COOKIE };
