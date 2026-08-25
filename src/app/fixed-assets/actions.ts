"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export type FixedAssetSource = { type: "SUPPLIER_BILL_LINE" | "PAYMENT_LINE"; lineId: string; reference: string } | null;
const roles = ["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT", "REVIEWER"];
async function context() { const value = await requireActiveTenant(); if (!value.user.staffRole || !roles.includes(value.user.staffRole)) throw new Error("Your role cannot manage fixed assets."); return value; }

const optional = z.preprocess((value) => value === "" ? undefined : value, z.string().trim().max(120).optional());
const schema = z.object({
  assetCode: z.string().trim().min(1).max(40), name: z.string().trim().min(2).max(180), category: z.string().trim().min(2).max(80), description: optional,
  acquiredOn: z.coerce.date(), depreciationStartsOn: z.coerce.date(), originalCost: z.coerce.number().positive(), residualValue: z.coerce.number().min(0), openingAccumulatedDepreciation: z.coerce.number().min(0), usefulLifeMonths: z.coerce.number().int().min(1).max(1200), method: z.literal("STRAIGHT_LINE"),
  assetAccountId: z.string().min(1), accumulatedDepreciationAccountId: z.string().min(1), depreciationExpenseAccountId: z.string().min(1), location: optional, registrationNumber: optional, status: z.enum(["ACTIVE", "FULLY_DEPRECIATED", "DISPOSED", "INACTIVE"]),
}).refine((value) => value.residualValue <= value.originalCost, { message: "Residual value cannot exceed original cost." }).refine((value) => value.openingAccumulatedDepreciation <= value.originalCost - value.residualValue, { message: "Opening accumulated depreciation exceeds the depreciable amount." });

async function validateAccounts(tenantId: string, input: z.infer<typeof schema>) {
  const rows = await db.account.findMany({ where: { tenantId, id: { in: [input.assetAccountId, input.accumulatedDepreciationAccountId, input.depreciationExpenseAccountId] }, isActive: true } });
  if (rows.length !== 3 || rows.find((account) => account.id === input.assetAccountId)?.type !== "ASSET" || rows.find((account) => account.id === input.accumulatedDepreciationAccountId)?.type !== "ASSET" || rows.find((account) => account.id === input.depreciationExpenseAccountId)?.type !== "EXPENSE") throw new Error("Select valid asset, accumulated-depreciation, and depreciation-expense accounts for this company.");
}
const data = (input: z.infer<typeof schema>) => ({ ...input, description: input.description || null, location: input.location || null, registrationNumber: input.registrationNumber || null, disposedOn: input.status === "DISPOSED" ? new Date() : null });
const day = (value: Date) => value.toISOString().slice(0, 10);

export async function createFixedAsset(source: FixedAssetSource, formData: FormData) {
  const { user, active } = await context();
  const sourceParam = source ? source.type === "SUPPLIER_BILL_LINE" ? `&sourceLineId=${encodeURIComponent(source.lineId)}` : `&paymentLineId=${encodeURIComponent(source.lineId)}` : "";
  const fail = (message: string): never => redirect(`/fixed-assets/new?error=${encodeURIComponent(message)}${sourceParam}`);
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Enter valid asset details.");
  const input = parsed.data!;
  await validateAccounts(active.id, input);
  if (await db.fixedAsset.count({ where: { tenantId: active.id, assetCode: input.assetCode } })) fail(`Asset code ${input.assetCode} already exists.`);
  if (source && await db.fixedAsset.count({ where: { tenantId: active.id, sourceLineId: source.lineId } })) fail("This transaction line is already registered as a fixed asset.");

  if (source?.type === "SUPPLIER_BILL_LINE") {
    const line = await db.supplierBillLine.findFirst({ where: { id: source.lineId, bill: { tenantId: active.id } }, include: { bill: true, expenseAccount: true } });
    if (!line || line.inventoryItemId || line.expenseAccount.type !== "ASSET") fail("The supplier-bill line is no longer eligible for fixed-asset registration.");
    const validLine = line!;
    const baseCost = Number(validLine.lineTotal) * Number(validLine.bill.exchangeRate);
    if (input.assetAccountId !== validLine.expenseAccountId || Math.abs(input.originalCost - baseCost) > 0.005 || day(input.acquiredOn) !== day(validLine.bill.billDate)) fail("The source transaction details changed. Reopen this asset from the supplier bill.");
  }
  if (source?.type === "PAYMENT_LINE") {
    const line = await db.paymentLine.findFirst({ where: { id: source.lineId, payment: { tenantId: active.id } }, include: { payment: true, account: true } });
    if (!line || line.inventoryItemId || line.account.type !== "ASSET") fail("The payment line is no longer eligible for fixed-asset registration.");
    const validLine = line!;
    if (input.assetAccountId !== validLine.accountId || Math.abs(input.originalCost - Number(validLine.baseAmount)) > 0.005 || day(input.acquiredOn) !== day(validLine.payment.paymentDate)) fail("The source transaction details changed. Reopen this asset from the payment.");
    const manualMatch = await db.fixedAsset.findFirst({ where: { tenantId: active.id, sourceLineId: null, assetAccountId: validLine.accountId, acquiredOn: validLine.payment.paymentDate, originalCost: validLine.baseAmount } });
    if (manualMatch) fail(`This payment already matches registered asset ${manualMatch.assetCode} — ${manualMatch.name}.`);
  }
  await db.$transaction(async (transaction) => {
    const row = await transaction.fixedAsset.create({ data: { tenantId: active.id, ...data(input), sourceType: source?.type ?? null, sourceLineId: source?.lineId ?? null, sourceReference: source?.reference ?? null } });
    await transaction.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_CREATED", entityType: "FixedAsset", entityId: row.id, newValues: { assetCode: row.assetCode, name: row.name, originalCost: row.originalCost, sourceType: row.sourceType, sourceReference: row.sourceReference } } });
  });
  redirect("/fixed-assets");
}

export async function linkFixedAssetToPaymentLine(assetId: string, paymentLineId: string) {
  const { user, active } = await context();
  const [asset, line] = await Promise.all([
    db.fixedAsset.findFirst({ where: { id: assetId, tenantId: active.id } }),
    db.paymentLine.findFirst({ where: { id: paymentLineId, payment: { tenantId: active.id } }, include: { payment: true, account: true } }),
  ]);
  if (!asset || !line) throw new Error("The asset or payment line is no longer available.");
  if (asset.sourceLineId) throw new Error("This asset is already connected to a source transaction.");
  if (line.inventoryItemId || line.account.type !== "ASSET") throw new Error("This payment line is not eligible for fixed-asset linking.");
  if (asset.assetAccountId !== line.accountId || day(asset.acquiredOn) !== day(line.payment.paymentDate) || Math.abs(Number(asset.originalCost) - Number(line.baseAmount)) > 0.005) throw new Error("The asset no longer matches the payment date, asset account, and base cost.");
  if (await db.fixedAsset.count({ where: { tenantId: active.id, sourceLineId: paymentLineId } })) throw new Error("This payment line is already connected to another fixed asset.");
  await db.$transaction(async (transaction) => {
    await transaction.fixedAsset.update({ where: { id: asset.id }, data: { sourceType: "PAYMENT_LINE", sourceLineId: line.id, sourceReference: line.payment.reference } });
    await transaction.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_SOURCE_LINKED", entityType: "FixedAsset", entityId: asset.id, previousValues: { sourceType: asset.sourceType, sourceLineId: asset.sourceLineId, sourceReference: asset.sourceReference }, newValues: { sourceType: "PAYMENT_LINE", sourceLineId: line.id, sourceReference: line.payment.reference } } });
  });
  redirect(`/payments/direct/${line.paymentId}/fixed-assets`);
}

export async function updateFixedAsset(id: string, formData: FormData) {
  const { user, active } = await context(), parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/fixed-assets/${id}/edit?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Enter valid asset details.")}`);
  const input = parsed.data, previous = await db.fixedAsset.findFirst({ where: { id, tenantId: active.id } });
  if (!previous) throw new Error("Fixed asset not found.");
  await validateAccounts(active.id, input);
  if (await db.fixedAsset.count({ where: { tenantId: active.id, assetCode: input.assetCode, id: { not: id } } })) redirect(`/fixed-assets/${id}/edit?error=${encodeURIComponent(`Asset code ${input.assetCode} already exists.`)}`);
  await db.$transaction([db.fixedAsset.update({ where: { id }, data: data(input) }), db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_UPDATED", entityType: "FixedAsset", entityId: id, previousValues: { assetCode: previous.assetCode, name: previous.name, status: previous.status }, newValues: { assetCode: input.assetCode, name: input.name, status: input.status } } })]);
  redirect("/fixed-assets");
}

export async function deleteFixedAsset(id: string, formData: FormData) {
  const { user, active } = await context(), reason = z.string().trim().min(5).max(240).parse(formData.get("reason"));
  z.literal("DELETE").parse(formData.get("confirmation"));
  const row = await db.fixedAsset.findFirst({ where: { id, tenantId: active.id } });
  if (!row) throw new Error("Fixed asset not found.");
  await db.$transaction(async (transaction) => { await transaction.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_DELETED", entityType: "FixedAsset", entityId: id, previousValues: { assetCode: row.assetCode, name: row.name, originalCost: row.originalCost }, reason } }); await transaction.fixedAsset.delete({ where: { id } }); });
  redirect("/fixed-assets");
}
