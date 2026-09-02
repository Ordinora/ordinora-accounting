"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { clientAssignmentNotificationDrafts } from "@/lib/notification-plans";
import { createNotifications } from "@/lib/notifications";
import { newlyAssignedTenantIds } from "@/lib/notification-rules";
import { requireStaff } from "@/lib/session";
import { assertMayChangeStaffRole, assertMayChangeStaffStatus, editableStaffRoles, uniqueStaffTenantIds } from "@/lib/staff-management";

const inputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(14).max(200),
  staffRole: z.enum(editableStaffRoles),
});
const editSchema = inputSchema.omit({ password: true }).extend({ staffId: z.string().min(1), staffRole: z.enum(["SYSTEM_ADMIN", ...editableStaffRoles]), reason: z.string().trim().min(5).max(240) });
const statusSchema = z.object({ staffId: z.string().min(1), nextActive: z.enum(["true", "false"]).transform((value) => value === "true"), reason: z.string().trim().min(5).max(240) });
const passwordSchema = z.object({ staffId: z.string().min(1), password: z.string().min(14).max(200), reason: z.string().trim().min(5).max(240) });

async function requireSystemAdministrator() {
  const administrator = await requireStaff();
  if (administrator.staffRole !== "SYSTEM_ADMIN") redirect("/");
  return administrator;
}

async function validatedTenantIds(firmId: string, formData: FormData, errorPath: string) {
  const tenantIds = uniqueStaffTenantIds(formData.getAll("tenantId"));
  if (!tenantIds.length) redirect(`${errorPath}?error=Assign+at+least+one+company+to+the+staff+member.`);
  const allowedTenants = await db.tenant.findMany({ where: { firmId, id: { in: tenantIds } }, select: { id: true } });
  if (allowedTenants.length !== tenantIds.length) redirect(`${errorPath}?error=One+or+more+company+assignments+are+invalid.`);
  return tenantIds;
}

export async function createAccountingStaff(formData: FormData) {
  const administrator = await requireStaff();
  if (administrator.staffRole !== "SYSTEM_ADMIN") redirect("/");

  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings/staff?error=Enter+valid+staff+details+and+a+password+of+at+least+14+characters.");

  const tenantIds = await validatedTenantIds(administrator.firmId, formData, "/settings/staff");
  const existing = await db.user.findUnique({ where: { firmId_email: { firmId: administrator.firmId, email: parsed.data.email } } });
  if (existing) redirect("/settings/staff?error=A+user+with+this+email+already+exists.");

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firmId: administrator.firmId,
        kind: "STAFF",
        email: parsed.data.email,
        displayName: parsed.data.displayName,
        passwordHash,
        staffRole: parsed.data.staffRole,
        assignments: { create: tenantIds.map((tenantId) => ({ tenantId })) },
      },
    });
    await tx.auditEvent.create({
      data: {
        firmId: administrator.firmId,
        actorId: administrator.id,
        actorKind: "STAFF",
        action: "STAFF_USER_CREATED",
        entityType: "User",
        entityId: created.id,
        newValues: { email: created.email, role: created.staffRole, tenantIds },
      },
    });
  });

  revalidatePath("/settings/staff");
  redirect("/settings/staff?success=Accounting+staff+account+created.");
}

export async function updateAccountingStaff(formData: FormData) {
  const administrator = await requireSystemAdministrator();
  const staffId = String(formData.get("staffId") ?? "");
  const errorPath = `/settings/staff/${staffId}/edit`;
  const parsed = editSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`${errorPath}?error=Enter+valid+staff+details+and+a+reason+for+the+update.`);
  const target = await db.user.findFirst({ where: { id: parsed.data.staffId, firmId: administrator.firmId, kind: "STAFF" }, include: { assignments: true } });
  if (!target) redirect("/settings/staff?error=Staff+member+not+found.");
  try { assertMayChangeStaffRole({ currentRole: target.staffRole, nextRole: parsed.data.staffRole }); }
  catch (error) { redirect(`${errorPath}?error=${encodeURIComponent(error instanceof Error ? error.message : "The role cannot be changed.")}`); }
  const tenantIds = target.staffRole === "SYSTEM_ADMIN" ? target.assignments.map((assignment) => assignment.tenantId) : await validatedTenantIds(administrator.firmId, formData, errorPath);
  const duplicate = await db.user.findFirst({ where: { firmId: administrator.firmId, email: { equals: parsed.data.email, mode: "insensitive" }, id: { not: target.id } }, select: { id: true } });
  if (duplicate) redirect(`${errorPath}?error=A+user+with+this+email+already+exists.`);
  const previousTenantIds = target.assignments.map((assignment) => assignment.tenantId).sort();
  const addedTenantIds = newlyAssignedTenantIds(previousTenantIds, tenantIds);
  await db.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: target.id }, data: { displayName: parsed.data.displayName, email: parsed.data.email, staffRole: parsed.data.staffRole } });
    if (target.staffRole !== "SYSTEM_ADMIN") {
      await tx.staffTenantAssignment.deleteMany({ where: { userId: target.id } });
      await tx.staffTenantAssignment.createMany({ data: tenantIds.map((tenantId) => ({ userId: target.id, tenantId })) });
    }
    await tx.auditEvent.create({ data: { firmId: administrator.firmId, actorId: administrator.id, actorKind: "STAFF", action: "STAFF_USER_UPDATED", entityType: "User", entityId: target.id, previousValues: { displayName: target.displayName, email: target.email, role: target.staffRole, tenantIds: previousTenantIds }, newValues: { displayName: updated.displayName, email: updated.email, role: updated.staffRole, tenantIds: [...tenantIds].sort() }, reason: parsed.data.reason } });
  });
  try {
    const newlyAssignedTenants = await db.tenant.findMany({ where: { firmId: administrator.firmId, id: { in: addedTenantIds } }, select: { id: true, legalName: true } });
    await createNotifications(clientAssignmentNotificationDrafts({ firmId: administrator.firmId, recipientId: target.id, previousTenantIds, tenants: newlyAssignedTenants }));
  } catch (notificationError) {
    console.error("Client assignment notifications could not be created.", notificationError);
  }
  revalidatePath("/settings/staff");
  revalidatePath(errorPath);
  redirect("/settings/staff?success=Staff+details+updated.");
}

export async function setAccountingStaffStatus(formData: FormData) {
  const administrator = await requireSystemAdministrator();
  const staffId = String(formData.get("staffId") ?? "");
  const errorPath = `/settings/staff/${staffId}/edit`;
  const result = statusSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(`${errorPath}?error=Enter+a+reason+of+at+least+5+characters.`);
  const parsed = result.data;
  const target = await db.user.findFirst({ where: { id: parsed.staffId, firmId: administrator.firmId, kind: "STAFF" } });
  if (!target) redirect("/settings/staff?error=Staff+member+not+found.");
  try { assertMayChangeStaffStatus({ actorId: administrator.id, targetId: target.id, nextActive: parsed.nextActive }); }
  catch (error) { redirect(`${errorPath}?error=${encodeURIComponent(error instanceof Error ? error.message : "This account status cannot be changed.")}`); }
  const changedAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { isActive: parsed.nextActive } });
    const revoked = parsed.nextActive ? { count: 0 } : await tx.session.updateMany({ where: { userId: target.id, revokedAt: null, expiresAt: { gt: changedAt } }, data: { revokedAt: changedAt } });
    await tx.auditEvent.create({ data: { firmId: administrator.firmId, actorId: administrator.id, actorKind: "STAFF", action: parsed.nextActive ? "STAFF_USER_REACTIVATED" : "STAFF_USER_DEACTIVATED", entityType: "User", entityId: target.id, previousValues: { isActive: target.isActive }, newValues: { isActive: parsed.nextActive, sessionsRevoked: revoked.count }, reason: parsed.reason } });
  });
  revalidatePath("/settings/staff");
  revalidatePath(`/settings/staff/${target.id}/edit`);
  redirect(`/settings/staff?success=Staff+account+${parsed.nextActive ? "reactivated" : "deactivated"}.`);
}

export async function resetAccountingStaffPassword(formData: FormData) {
  const administrator = await requireSystemAdministrator();
  const staffId = String(formData.get("staffId") ?? "");
  const errorPath = `/settings/staff/${staffId}/edit`;
  const result = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(`${errorPath}?error=Enter+a+password+of+at+least+14+characters+and+a+reason.`);
  const parsed = result.data;
  const target = await db.user.findFirst({ where: { id: parsed.staffId, firmId: administrator.firmId, kind: "STAFF" } });
  if (!target) redirect("/settings/staff?error=Staff+member+not+found.");
  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const resetAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { passwordHash } });
    const revoked = await tx.session.updateMany({ where: { userId: target.id, revokedAt: null, expiresAt: { gt: resetAt } }, data: { revokedAt: resetAt } });
    await tx.auditEvent.create({ data: { firmId: administrator.firmId, actorId: administrator.id, actorKind: "STAFF", action: "STAFF_PASSWORD_RESET", entityType: "User", entityId: target.id, previousValues: { passwordReset: false }, newValues: { passwordReset: true, resetAt, sessionsRevoked: revoked.count }, reason: parsed.reason } });
  });
  revalidatePath("/settings/staff");
  if (target.id === administrator.id) redirect("/login");
  redirect("/settings/staff?success=Staff+password+reset+and+active+sessions+revoked.");
}
