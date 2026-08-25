"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bruneiChart } from "../../../../prisma/brunei-chart";
import { monthlyAccountingPeriods } from "@/lib/company-setup";
import { db } from "@/lib/db";
import { ACTIVE_TENANT_COOKIE, requireStaff } from "@/lib/session";

export type CreateCompanyState = { error?: string };

const schema = z.object({
  legalName: z.string().trim().min(2).max(160), tradingName: z.string().trim().max(160), registrationNumber: z.string().trim().max(80),
  entityType: z.enum(["PRIVATE_LIMITED", "SOLE_PROPRIETORSHIP", "PARTNERSHIP", "OTHER"]), registeredAddress: z.string().trim().max(500),
  primaryContact: z.string().trim().max(160), defaultCurrency: z.string().trim().length(3), financialYearEndMonth: z.coerce.number().int().min(1).max(12),
  financialYearEndDay: z.coerce.number().int().min(1).max(31), setupYear: z.coerce.number().int().min(2000).max(2100), multiCurrencyEnabled: z.string().optional(),
});

export async function createCompany(_state: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  let tenantId: string | undefined;
  try {
    const user = await requireStaff();
    if (user.staffRole !== "SYSTEM_ADMIN") throw new Error("Only the System Administrator can create companies.");
    const input = schema.parse(Object.fromEntries(formData));
    const periods = monthlyAccountingPeriods(input.setupYear);
    const duplicate = await db.tenant.count({ where: { firmId: user.firmId, legalName: { equals: input.legalName, mode: "insensitive" } } });
    if (duplicate) throw new Error("A company with this legal name already exists.");
    const created = await db.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: {
        firmId: user.firmId, legalName: input.legalName, tradingName: input.tradingName || null, registrationNumber: input.registrationNumber || null,
        entityType: input.entityType, registeredAddress: input.registeredAddress || null, primaryContact: input.primaryContact || null,
        financialYearEndMonth: input.financialYearEndMonth, financialYearEndDay: input.financialYearEndDay, defaultCurrency: input.defaultCurrency.toUpperCase(),
        multiCurrencyEnabled: input.multiCurrencyEnabled === "on", portalEnabled: false, reportMode: "LIVE_POSTED_AND_PUBLISHED",
        documentUploadEnabled: false, enabledDashboardCards: ["cash", "revenue", "receivables", "payables"],
      } });
      await tx.staffTenantAssignment.upsert({ where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } }, update: {}, create: { userId: user.id, tenantId: tenant.id } });
      await tx.account.createMany({ data: bruneiChart.map(([code, name, type, reportingClassification, isControlAccount]) => ({ tenantId: tenant.id, code, name, type, reportingClassification, isControlAccount: Boolean(isControlAccount) })) });
      await tx.accountingPeriod.createMany({ data: periods.map((period) => ({ tenantId: tenant.id, ...period })) });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: tenant.id, actorId: user.id, actorKind: "STAFF", action: "COMPANY_CREATED", entityType: "Tenant", entityId: tenant.id, newValues: { legalName: tenant.legalName, setupYear: input.setupYear, accountsCreated: bruneiChart.length, periodsCreated: periods.length } } });
      return tenant;
    });
    tenantId = created.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The company could not be created." };
  }
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  redirect("/");
}
