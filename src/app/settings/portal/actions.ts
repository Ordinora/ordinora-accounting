"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

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
    const created = await db.$transaction(async (tx) => {
      const client = await tx.user.create({ data: { firmId: user.firmId, tenantId: active.id, kind: "CLIENT", displayName: input.displayName, email: input.email, passwordHash, clientRole: input.clientRole } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "CLIENT_USER_CREATED", entityType: "User", entityId: client.id, newValues: { email: client.email, clientRole: client.clientRole } } });
      return client;
    });
    revalidatePath("/settings/portal");
    return { success: `${created.displayName} can now sign in through the client portal.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The client user could not be created." };
  }
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
}
