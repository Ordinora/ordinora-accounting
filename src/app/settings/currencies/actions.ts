"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeCurrencyCode, validateExchangeRate } from "@/lib/currency";
import { requireActiveTenant } from "@/lib/session";

function authorize(role: string | null) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(role)) throw new Error("Your role cannot manage currencies.");
}

export async function enableMulticurrency(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const baseCode = normalizeCurrencyCode(String(formData.get("baseCurrency") ?? active.defaultCurrency));
  const hasPostings = await db.journal.count({ where: { tenantId: active.id, status: "POSTED" } });
  if (hasPostings && baseCode !== active.defaultCurrency) throw new Error("Base currency cannot be changed after transactions have been posted.");
  await db.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: active.id }, data: { defaultCurrency: baseCode, multiCurrencyEnabled: true, baseCurrencyLockedAt: hasPostings ? (active.baseCurrencyLockedAt ?? new Date()) : null } });
    await tx.tenantCurrency.upsert({ where: { tenantId_code: { tenantId: active.id, code: baseCode } }, update: { isActive: true }, create: { tenantId: active.id, code: baseCode, name: baseCode === "BND" ? "Brunei Dollar" : baseCode, symbol: baseCode === "BND" ? "B$" : baseCode } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "MULTICURRENCY_ENABLED", entityType: "Tenant", entityId: active.id, newValues: { baseCurrency: baseCode } } });
  });
  revalidatePath("/settings/currencies");
}

const currencySchema = z.object({ code: z.string(), name: z.string().trim().min(2).max(60), symbol: z.string().trim().min(1).max(8), decimalPlaces: z.coerce.number().int().min(0).max(4) });
export async function addCurrency(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  if (!active.multiCurrencyEnabled) throw new Error("Enable multicurrency first.");
  const parsed = currencySchema.parse(Object.fromEntries(formData)); const code = normalizeCurrencyCode(parsed.code);
  if (code === active.defaultCurrency) throw new Error("The base currency already exists.");
  await db.$transaction(async tx => {
    await tx.tenantCurrency.upsert({ where: { tenantId_code: { tenantId: active.id, code } }, update: { ...parsed, code, isActive: true }, create: { tenantId: active.id, ...parsed, code } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FOREIGN_CURRENCY_CONFIGURED", entityType: "TenantCurrency", newValues: { code, name: parsed.name, decimalPlaces: parsed.decimalPlaces } } });
  });
  revalidatePath("/settings/currencies");
}

const rateSchema = z.object({ currencyCode: z.string(), effectiveOn: z.coerce.date(), rateToBase: z.string() });
export async function saveExchangeRate(formData: FormData) {
  const { user, active } = await requireActiveTenant(); authorize(user.staffRole);
  const parsed = rateSchema.parse(Object.fromEntries(formData)); const currencyCode = normalizeCurrencyCode(parsed.currencyCode); const rateToBase = validateExchangeRate(parsed.rateToBase);
  const currency = await db.tenantCurrency.findUnique({ where: { tenantId_code: { tenantId: active.id, code: currencyCode } } });
  if (!currency || !currency.isActive || currencyCode === active.defaultCurrency) throw new Error("Select an active foreign currency.");
  await db.$transaction(async tx => {
    const rate = await tx.exchangeRate.upsert({ where: { tenantId_currencyCode_effectiveOn: { tenantId: active.id, currencyCode, effectiveOn: parsed.effectiveOn } }, update: { rateToBase, createdById: user.id }, create: { tenantId: active.id, currencyCode, effectiveOn: parsed.effectiveOn, rateToBase, createdById: user.id } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "EXCHANGE_RATE_SAVED", entityType: "ExchangeRate", entityId: rate.id, newValues: { currencyCode, effectiveOn: parsed.effectiveOn.toISOString().slice(0,10), rateToBase: rateToBase.toString() } } });
  });
  revalidatePath("/settings/currencies");
}
