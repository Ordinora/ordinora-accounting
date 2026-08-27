"use server";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildReportSnapshot } from "@/lib/report-snapshot";
import { requireActiveTenant } from "@/lib/session";

const schema = z.object({ type: z.enum(["trial-balance", "profit-loss", "income-statement", "revenue-statement", "balance-sheet", "receivables", "payables", "inventory"]), from: z.coerce.date(), asOf: z.coerce.date() });
export async function publishReport(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot publish reports.");
  const input = schema.parse(Object.fromEntries(formData));
  const period = await db.accountingPeriod.findFirst({ where: { tenantId: active.id, startsOn: { lte: input.asOf }, endsOn: { gte: input.asOf } } });
  if (!period) throw new Error("Create an accounting period containing the report end date before publishing.");
  const snapshot = await buildReportSnapshot(active, input.type, input.from, input.asOf);
  const latest = await db.reportVersion.findFirst({ where: { tenantId: active.id, periodId: period.id, reportType: input.type }, orderBy: { version: "desc" } });
  const latestPosting = await db.journal.findFirst({ where: { tenantId: active.id, status: { in: ["POSTED", "REVERSED"] }, accountingDate: { lte: input.asOf } }, orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
  await db.$transaction(async tx => {
    if (latest?.state === "PUBLISHED") await tx.reportVersion.update({ where: { id: latest.id }, data: { state: "SUPERSEDED" } });
    const report = await tx.reportVersion.create({ data: { tenantId: active.id, periodId: period.id, reportType: input.type, state: "PUBLISHED", version: (latest?.version ?? 0) + 1, payload: snapshot as unknown as Prisma.InputJsonValue, disclaimer: "Prepared from posted accounting entries. Subsequent postings may change live balances.", latestPostingAt: latestPosting?.updatedAt, publishedAt: new Date(), publishedById: user.id, supersedesId: latest?.id } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "REPORT_PUBLISHED", entityType: "ReportVersion", entityId: report.id, newValues: { reportType: input.type, version: report.version, periodId: period.id } } });
  });
  redirect("/reports/published");
}
