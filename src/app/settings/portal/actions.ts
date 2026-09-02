"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { withTransactionNotice } from "@/lib/transaction-notice";

const portalSettingsSchema = z.object({
  portalEnabled: z.boolean(),
  reportMode: z.enum(["PUBLISHED_ONLY", "LIVE_POSTED_AND_PUBLISHED"]),
  documentUploadEnabled: z.boolean(),
  payrollVisibility: z.boolean(),
  enabledDashboardCards: z.array(z.enum(["cash", "revenue", "receivables", "payables", "profit"])),
});

export async function updatePortalSettings(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) {
    throw new Error("Your role cannot change client portal settings.");
  }

  const settings = portalSettingsSchema.parse({
    portalEnabled: formData.get("portalEnabled") === "on",
    reportMode: formData.get("reportMode"),
    documentUploadEnabled: formData.get("documentUploadEnabled") === "on",
    payrollVisibility: formData.get("payrollVisibility") === "on",
    enabledDashboardCards: formData.getAll("enabledDashboardCards"),
  });

  await db.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: active.id },
      data: settings,
    });
    await tx.auditEvent.create({
      data: {
        firmId: user.firmId,
        tenantId: active.id,
        actorId: user.id,
        actorKind: "STAFF",
        action: "PORTAL_SETTINGS_UPDATED",
        entityType: "Tenant",
        entityId: active.id,
        newValues: settings,
      },
    });
  });

  revalidatePath("/settings/portal");
  redirect(withTransactionNotice("/settings/portal", "portal-settings-saved"));
}

export type ClientUserState = { error?: string; success?: string };
const clientUserSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128),
  clientRole: z.enum(["CLIENT_ADMIN", "CLIENT_DIRECTOR", "CLIENT_FINANCE_VIEWER", "CLIENT_PAYROLL_VIEWER", "CLIENT_DOCUMENT_CONTRIBUTOR"]),
});

export async function createClientUser(_state: ClientUserState, formData: FormData): Promise<ClientUserState> {
  try {
    const { user, active } = await requireActiveTenant();
    if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot add client users.");
    const input = clientUserSchema.parse(Object.fromEntries(formData));
    const duplicate = await db.user.count({ where: { firmId: user.firmId, email: { equals: input.email, mode: "insensitive" } } });
    if (duplicate) throw new Error("A user with this email address already exists.");
    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.$transaction(async (tx) => {
      const client = await tx.user.create({ data: { firmId: user.firmId, tenantId: active.id, kind: "CLIENT", displayName: input.displayName, email: input.email, passwordHash, clientRole: input.clientRole } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "CLIENT_USER_CREATED", entityType: "User", entityId: client.id, newValues: { email: client.email, clientRole: client.clientRole } } });
      return client;
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The client user could not be created." };
  }
  revalidatePath("/settings/portal");
  redirect(withTransactionNotice("/settings/portal", "client-user-created"));
}

export async function updateClientUser(userId: string, formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot update client users.");
  const clientRole = z.enum(["CLIENT_ADMIN", "CLIENT_DIRECTOR", "CLIENT_FINANCE_VIEWER", "CLIENT_PAYROLL_VIEWER", "CLIENT_DOCUMENT_CONTRIBUTOR"]).parse(formData.get("clientRole"));
  const isActive = formData.get("isActive") === "on";
  const client = await db.user.findFirst({ where: { id: userId, tenantId: active.id, kind: "CLIENT" } });
  if (!client) throw new Error("Client user not found for this company.");
  await db.$transaction([
    db.user.update({ where: { id: client.id }, data: { clientRole, isActive } }),
    db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "CLIENT_USER_UPDATED", entityType: "User", entityId: client.id, previousValues: { clientRole: client.clientRole, isActive: client.isActive }, newValues: { clientRole, isActive } } }),
  ]);
  if (!isActive) await db.session.updateMany({ where: { userId: client.id, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/settings/portal");
  redirect(withTransactionNotice("/settings/portal", "client-user-updated"));
}

const clientPasswordSchema = z.object({
  password: z.string().min(12, "Use at least 12 characters.").max(128),
});

export async function resetClientUserPassword(userId: string, _state: ClientUserState, formData: FormData): Promise<ClientUserState> {
  try {
    const { user, active } = await requireActiveTenant();
    if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) {
      throw new Error("Your role cannot reset client passwords.");
    }

    const { password } = clientPasswordSchema.parse({ password: formData.get("password") });
    const client = await db.user.findFirst({
      where: { id: userId, firmId: user.firmId, tenantId: active.id, kind: "CLIENT" },
      select: { id: true, displayName: true, email: true },
    });
    if (!client) throw new Error("Client user not found for this company.");

    const passwordHash = await bcrypt.hash(password, 12);
    await db.$transaction([
      db.user.update({ where: { id: client.id }, data: { passwordHash } }),
      db.session.updateMany({ where: { userId: client.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      db.auditEvent.create({
        data: {
          firmId: user.firmId,
          tenantId: active.id,
          actorId: user.id,
          actorKind: "STAFF",
          action: "CLIENT_USER_PASSWORD_RESET",
          entityType: "User",
          entityId: client.id,
          newValues: { email: client.email, passwordReset: true, activeSessionsRevoked: true },
        },
      }),
    ]);

  } catch (error) {
    if (error instanceof z.ZodError) return { error: error.issues[0]?.message ?? "Enter a valid password." };
    return { error: error instanceof Error ? error.message : "The client password could not be reset." };
  }
  revalidatePath("/settings/portal");
  redirect(withTransactionNotice("/settings/portal", "client-password-reset"));
}
