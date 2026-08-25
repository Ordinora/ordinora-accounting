"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { monthEndChecklistDefinition } from "@/lib/month-end-checklist";
import { requireActiveTenant } from "@/lib/session";

const inputSchema = z.object({
  periodId: z.string().min(1),
  key: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function updateMonthEndChecklist(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) {
    throw new Error("Your role cannot complete month-end controls.");
  }
  const input = inputSchema.parse(Object.fromEntries(formData));
  const definition = monthEndChecklistDefinition(input.key);
  if (!definition) throw new Error("Unknown month-end checklist item.");
  const period = await db.accountingPeriod.findFirst({ where: { id: input.periodId, tenantId: active.id } });
  if (!period) throw new Error("Accounting period not found.");
  if (["LOCKED", "FINALIZED"].includes(period.status)) throw new Error("A locked or finalized period checklist cannot be changed.");
  const completed = formData.get("completed") === "true";
  const notes = input.notes || null;

  await db.$transaction(async (tx) => {
    const previous = await tx.monthEndChecklistItem.findUnique({ where: { periodId_key: { periodId: period.id, key: definition.key } } });
    const item = await tx.monthEndChecklistItem.upsert({
      where: { periodId_key: { periodId: period.id, key: definition.key } },
      create: { tenantId: active.id, periodId: period.id, key: definition.key, label: definition.label, completed, notes, completedById: completed ? user.id : null, completedAt: completed ? new Date() : null },
      update: { label: definition.label, completed, notes, completedById: completed ? user.id : null, completedAt: completed ? new Date() : null },
    });
    await tx.auditEvent.create({
      data: {
        firmId: user.firmId,
        tenantId: active.id,
        actorId: user.id,
        actorKind: "STAFF",
        action: "MONTH_END_CHECKLIST_UPDATED",
        entityType: "MonthEndChecklistItem",
        entityId: item.id,
        previousValues: previous ? { completed: previous.completed, notes: previous.notes } : undefined,
        newValues: { periodId: period.id, key: definition.key, completed, notes },
      },
    });
  });
  revalidatePath("/accounting/month-end");
  redirect(`/accounting/month-end?asOf=${input.asOf}`);
}
