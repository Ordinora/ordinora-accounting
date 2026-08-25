"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/session";

const schema = z.object({
  sessionId: z.string().min(1),
  reason: z.string().trim().min(5).max(240),
});

export async function revokeSession(formData: FormData) {
  const actor = await requireStaff();
  if (!actor.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(actor.staffRole)) throw new Error("Only a firm administrator can revoke sessions.");
  const input = schema.parse(Object.fromEntries(formData));
  const target = await db.session.findFirst({
    where: { id: input.sessionId, user: { firmId: actor.firmId } },
    include: { user: { select: { id: true, email: true, kind: true } } },
  });
  if (!target) throw new Error("Session not found.");

  const revokedAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.session.updateMany({ where: { id: target.id, revokedAt: null }, data: { revokedAt } });
    await tx.auditEvent.create({
      data: {
        firmId: actor.firmId,
        actorId: actor.id,
        actorKind: "STAFF",
        action: "SESSION_REVOKED_BY_ADMIN",
        entityType: "Session",
        entityId: target.id,
        previousValues: { userId: target.user.id, userKind: target.user.kind, expiresAt: target.expiresAt, revokedAt: target.revokedAt },
        newValues: { revokedAt },
        reason: input.reason,
      },
    });
  });
  revalidatePath("/settings/security/sessions");
}
