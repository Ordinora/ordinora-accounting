"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const inputSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(14).max(200),
  staffRole: z.enum(["ACCOUNTANT", "PAYROLL_OFFICER", "REVIEWER", "READ_ONLY"]),
});

export async function createAccountingStaff(formData: FormData) {
  const administrator = await requireStaff();
  if (administrator.staffRole !== "SYSTEM_ADMIN") redirect("/");

  const parsed = inputSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/settings/staff?error=Enter+valid+staff+details+and+a+password+of+at+least+14+characters.");

  const tenantIds = [...new Set(formData.getAll("tenantId").map(String).filter(Boolean))];
  if (!tenantIds.length) redirect("/settings/staff?error=Assign+at+least+one+company+to+the+staff+member.");

  const allowedTenants = await db.tenant.findMany({ where: { firmId: administrator.firmId, id: { in: tenantIds } }, select: { id: true } });
  if (allowedTenants.length !== tenantIds.length) redirect("/settings/staff?error=One+or+more+company+assignments+are+invalid.");

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
