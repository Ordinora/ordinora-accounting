"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { bruneiChart, controlRoleForChartCode } from "../../../../prisma/brunei-chart";
import { monthlyAccountingPeriods } from "@/lib/company-setup";
import { db } from "@/lib/db";
import { ACTIVE_TENANT_COOKIE, requireStaff } from "@/lib/session";

export type CreateCompanyState = { error?: string };
export type UpdateCompanyState = { error?: string };

const schema = z.object({
  legalName: z.string().trim().min(2).max(160), tradingName: z.string().trim().max(160), registrationNumber: z.string().trim().max(80),
  email: z.string().trim().max(254).refine((value) => value === "" || z.string().email().safeParse(value).success, "Enter a valid company email address."),
  entityType: z.enum(["PRIVATE_LIMITED", "SOLE_PROPRIETORSHIP", "PARTNERSHIP", "OTHER"]), registeredAddress: z.string().trim().max(500),
  primaryContact: z.string().trim().max(160), defaultCurrency: z.string().trim().length(3), financialYearEndMonth: z.coerce.number().int().min(1).max(12),
  financialYearEndDay: z.coerce.number().int().min(1).max(31), setupYear: z.coerce.number().int().min(2000).max(2100), multiCurrencyEnabled: z.string().optional(),
});

const updateSchema = schema.omit({ setupYear: true }).extend({
  companyId: z.string().min(1),
  status: z.enum(["ACTIVE", "DORMANT"]),
  reason: z.string().trim().min(5, "Enter a short reason for the update.").max(240),
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
        firmId: user.firmId, legalName: input.legalName, tradingName: input.tradingName || null, registrationNumber: input.registrationNumber || null, email: input.email || null,
        entityType: input.entityType, registeredAddress: input.registeredAddress || null, primaryContact: input.primaryContact || null,
        financialYearEndMonth: input.financialYearEndMonth, financialYearEndDay: input.financialYearEndDay, defaultCurrency: input.defaultCurrency.toUpperCase(),
        multiCurrencyEnabled: input.multiCurrencyEnabled === "on", portalEnabled: false, reportMode: "LIVE_POSTED_AND_PUBLISHED",
        documentUploadEnabled: false, enabledDashboardCards: ["cash", "revenue", "receivables", "payables"],
      } });
      await tx.staffTenantAssignment.upsert({ where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } }, update: {}, create: { userId: user.id, tenantId: tenant.id } });
      await tx.account.createMany({ data: bruneiChart.map(([code, name, type, reportingClassification, isControlAccount]) => ({ tenantId: tenant.id, code, name, type, reportingClassification, isControlAccount: Boolean(isControlAccount), controlRole: controlRoleForChartCode(code) })) });
      await tx.accountingPeriod.createMany({ data: periods.map((period) => ({ tenantId: tenant.id, ...period })) });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: tenant.id, actorId: user.id, actorKind: "STAFF", action: "COMPANY_CREATED", entityType: "Tenant", entityId: tenant.id, newValues: { legalName: tenant.legalName, email: tenant.email, setupYear: input.setupYear, accountsCreated: bruneiChart.length, periodsCreated: periods.length } } });
      return tenant;
    });
    tenantId = created.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The company could not be created." };
  }
  (await cookies()).set(ACTIVE_TENANT_COOKIE, tenantId!, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
  redirect("/");
}

export async function updateCompany(_state: UpdateCompanyState, formData: FormData): Promise<UpdateCompanyState> {
  let companyId = "";
  try {
    const user = await requireStaff();
    if (user.staffRole !== "SYSTEM_ADMIN") throw new Error("Only the System Administrator can update companies.");
    const input = updateSchema.parse(Object.fromEntries(formData));
    companyId = input.companyId;
    const company = await db.tenant.findFirst({ where: { id: input.companyId, firmId: user.firmId }, include: { _count: { select: { journals: true } } } });
    if (!company) throw new Error("Company not found.");
    const duplicate = await db.tenant.count({ where: { firmId: user.firmId, id: { not: company.id }, legalName: { equals: input.legalName, mode: "insensitive" } } });
    if (duplicate) throw new Error("A company with this legal name already exists.");
    const currency = input.defaultCurrency.toUpperCase();
    if (company._count.journals > 0 && currency !== company.defaultCurrency) throw new Error("Base currency cannot be changed after accounting entries have been posted.");
    await db.$transaction(async (tx) => {
      const updated = await tx.tenant.update({ where: { id: company.id }, data: {
        legalName: input.legalName, tradingName: input.tradingName || null, registrationNumber: input.registrationNumber || null, email: input.email || null,
        entityType: input.entityType, registeredAddress: input.registeredAddress || null, primaryContact: input.primaryContact || null,
        defaultCurrency: currency, financialYearEndMonth: input.financialYearEndMonth, financialYearEndDay: input.financialYearEndDay,
        multiCurrencyEnabled: input.multiCurrencyEnabled === "on", status: input.status,
      } });
      await tx.auditEvent.create({ data: {
        firmId: user.firmId, tenantId: company.id, actorId: user.id, actorKind: "STAFF", action: "COMPANY_UPDATED", entityType: "Tenant", entityId: company.id,
        previousValues: { legalName: company.legalName, tradingName: company.tradingName, registrationNumber: company.registrationNumber, email: company.email, entityType: company.entityType, registeredAddress: company.registeredAddress, primaryContact: company.primaryContact, defaultCurrency: company.defaultCurrency, financialYearEndMonth: company.financialYearEndMonth, financialYearEndDay: company.financialYearEndDay, multiCurrencyEnabled: company.multiCurrencyEnabled, status: company.status },
        newValues: { legalName: updated.legalName, tradingName: updated.tradingName, registrationNumber: updated.registrationNumber, email: updated.email, entityType: updated.entityType, registeredAddress: updated.registeredAddress, primaryContact: updated.primaryContact, defaultCurrency: updated.defaultCurrency, financialYearEndMonth: updated.financialYearEndMonth, financialYearEndDay: updated.financialYearEndDay, multiCurrencyEnabled: updated.multiCurrencyEnabled, status: updated.status },
        reason: input.reason,
      } });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The company could not be updated." };
  }
  revalidatePath("/settings/companies");
  revalidatePath(`/settings/companies/${companyId}/edit`);
  revalidatePath("/", "layout");
  redirect("/settings/companies");
}
