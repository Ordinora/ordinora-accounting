"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

function authorize(role: string | null) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) {
    throw new Error("Your role cannot manage accounting periods.");
  }
}

const periodSchema = z.object({
  name: z.string().trim().min(2).max(60),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date(),
});

async function assertNoOverlap(tenantId: string, startsOn: Date, endsOn: Date, excludeId?: string) {
  if (startsOn > endsOn) throw new Error("The period start date must be before its end date.");
  const overlap = await db.accountingPeriod.findFirst({
    where: {
      tenantId,
      id: excludeId ? { not: excludeId } : undefined,
      startsOn: { lte: endsOn },
      endsOn: { gte: startsOn },
    },
  });
  if (overlap) throw new Error(`These dates overlap the existing period “${overlap.name}”.`);
}

async function activityCount(periodId: string) {
  const counts = await Promise.all([
    db.journal.count({ where: { periodId } }),
    db.salesInvoice.count({ where: { periodId } }),
    db.supplierBill.count({ where: { periodId } }),
    db.salesCreditNote.count({ where: { periodId } }),
    db.supplierCreditNote.count({ where: { periodId } }),
    db.customerReceipt.count({ where: { periodId } }),
    db.supplierPayment.count({ where: { periodId } }),
    db.dailyCashRegister.count({ where: { periodId } }),
    db.inventoryOperation.count({ where: { periodId } }),
    db.payrollRun.count({ where: { periodId } }),
    db.reportVersion.count({ where: { periodId } }),
  ]);
  return counts.reduce((sum, value) => sum + value, 0);
}

export async function createPeriod(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const input = periodSchema.parse(Object.fromEntries(formData));
  await assertNoOverlap(active.id, input.startsOn, input.endsOn);
  await db.$transaction(async (tx) => {
    const period = await tx.accountingPeriod.create({ data: { tenantId: active.id, ...input, status: "OPEN" } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNTING_PERIOD_CREATED", entityType: "AccountingPeriod", entityId: period.id, newValues: { name: period.name, startsOn: input.startsOn.toISOString(), endsOn: input.endsOn.toISOString(), status: "OPEN" } } });
  });
  revalidatePath("/settings/periods");
}

export async function updatePeriod(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("periodId"));
  const input = periodSchema.parse(Object.fromEntries(formData));
  const period = await db.accountingPeriod.findFirst({ where: { id, tenantId: active.id } });
  if (!period) throw new Error("Accounting period not found.");
  if (period.status === "LOCKED" || period.status === "FINALIZED") throw new Error("Locked or finalized periods cannot be edited.");
  const used = (await activityCount(period.id)) > 0;
  const datesChanged = period.startsOn.getTime() !== input.startsOn.getTime() || period.endsOn.getTime() !== input.endsOn.getTime();
  if (used && datesChanged) throw new Error("This period already contains accounting activity. Its dates cannot be changed; create a new period instead.");
  await assertNoOverlap(active.id, input.startsOn, input.endsOn, period.id);
  await db.$transaction(async (tx) => {
    await tx.accountingPeriod.update({ where: { id: period.id }, data: input });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNTING_PERIOD_UPDATED", entityType: "AccountingPeriod", entityId: period.id, previousValues: { name: period.name, startsOn: period.startsOn.toISOString(), endsOn: period.endsOn.toISOString() }, newValues: { name: input.name, startsOn: input.startsOn.toISOString(), endsOn: input.endsOn.toISOString() } } });
  });
  revalidatePath("/settings/periods");
  redirect("/settings/periods");
}

export async function changePeriodStatus(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("periodId"));
  const target = z.enum(["OPEN", "CLOSED", "LOCKED"]).parse(formData.get("target"));
  const period = await db.accountingPeriod.findFirst({ where: { id, tenantId: active.id } });
  if (!period) throw new Error("Accounting period not found.");
  if (period.status === "FINALIZED") throw new Error("A finalized period cannot be reopened.");
  if (period.status === "LOCKED" && target !== "LOCKED" && !["SYSTEM_ADMIN", "FIRM_ADMIN"].includes(user.staffRole ?? "")) {
    throw new Error("Only an administrator can reopen a locked period.");
  }
  if (target === "LOCKED") {
    const [unpostedJournals, unfinishedPayroll] = await Promise.all([
      db.journal.count({ where: { periodId: id, status: { in: ["DRAFT", "IN_REVIEW", "APPROVED"] } } }),
      db.payrollRun.count({ where: { periodId: id, status: { in: ["DRAFT", "APPROVED"] } } }),
    ]);
    if (unpostedJournals || unfinishedPayroll) throw new Error("Complete or remove draft workflows before locking this period.");
  }
  await db.$transaction(async (tx) => {
    await tx.accountingPeriod.update({ where: { id }, data: { status: target, lockedAt: target === "LOCKED" ? new Date() : null } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: `ACCOUNTING_PERIOD_${target}`, entityType: "AccountingPeriod", entityId: id, previousValues: { status: period.status }, newValues: { status: target } } });
  });
  revalidatePath("/settings/periods");
  revalidatePath("/payroll/runs/new");
}
