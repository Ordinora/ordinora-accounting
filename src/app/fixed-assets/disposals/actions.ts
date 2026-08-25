"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateFixedAssetDisposal } from "@/lib/fixed-asset-disposal";
import { calculateFixedAssetBookValue } from "@/lib/fixed-assets";
import { requireActiveTenant } from "@/lib/session";

const schema = z.object({
  fixedAssetId: z.string().min(1),
  disposalDate: z.coerce.date(),
  proceeds: z.coerce.number().min(0),
  proceedsAccountId: z.string().min(1),
  gainAccountId: z.string().optional(),
  lossAccountId: z.string().optional(),
  reason: z.string().trim().min(5).max(240),
});

export async function postFixedAssetDisposal(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot dispose fixed assets.");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/fixed-assets/disposals/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Enter valid disposal details.")}`);
  const input = parsed.data;

  try {
    await db.$transaction(async (tx) => {
    const [asset, period, accounts] = await Promise.all([
      tx.fixedAsset.findFirst({ where: { id: input.fixedAssetId, tenantId: active.id, status: { in: ["ACTIVE", "FULLY_DEPRECIATED"] } }, include: { depreciationEntries: true, disposal: true } }),
      tx.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN", startsOn: { lte: input.disposalDate }, endsOn: { gte: input.disposalDate } }, orderBy: { startsOn: "desc" } }),
      tx.account.findMany({ where: { tenantId: active.id, id: { in: [input.proceedsAccountId, input.gainAccountId || "", input.lossAccountId || ""] }, isActive: true } }),
    ]);
    if (!asset || asset.disposal) throw new Error("Select an active fixed asset that has not already been disposed.");
    if (!period) throw new Error("The disposal date is not inside an open accounting period. Open that month under Administration → Accounting periods, or choose another date.");
    if (input.disposalDate < asset.acquiredOn) throw new Error("Disposal date cannot be before the acquisition date.");
    const proceedsAccount = accounts.find((account) => account.id === input.proceedsAccountId);
    if (!proceedsAccount || proceedsAccount.type !== "ASSET") throw new Error("Select a valid proceeds cash, bank, or receivable asset account.");

    const calculation = calculateFixedAssetDisposal({
      originalCost: Number(asset.originalCost),
      openingAccumulatedDepreciation: Number(asset.openingAccumulatedDepreciation),
      postedDepreciation: asset.depreciationEntries.reduce((sum, entry) => sum + Number(entry.amount), 0),
      proceeds: input.proceeds,
    });
    const scheduled = calculateFixedAssetBookValue({ originalCost: Number(asset.originalCost), residualValue: Number(asset.residualValue), openingAccumulatedDepreciation: Number(asset.openingAccumulatedDepreciation), usefulLifeMonths: asset.usefulLifeMonths, depreciationStartsOn: asset.depreciationStartsOn, asOf: input.disposalDate });
    const depreciationDue = Math.max(0, scheduled.accumulatedDepreciation - calculation.accumulatedDepreciation);
    if (depreciationDue > 0.005) throw new Error(`Post ${active.defaultCurrency} ${depreciationDue.toFixed(2)} depreciation through the disposal date before disposing this asset.`);
    if (calculation.gain > 0 && accounts.find((account) => account.id === input.gainAccountId)?.type !== "REVENUE") throw new Error("Select a revenue account for the gain on disposal.");
    if (calculation.loss > 0 && accounts.find((account) => account.id === input.lossAccountId)?.type !== "EXPENSE") throw new Error("Select an expense account for the loss on disposal.");

    const zero = new Prisma.Decimal(0);
    const lines = [
      ...(input.proceeds > 0 ? [{ accountId: input.proceedsAccountId, description: `Disposal proceeds — ${asset.name}`, debit: new Prisma.Decimal(input.proceeds), credit: zero }] : []),
      ...(calculation.accumulatedDepreciation > 0 ? [{ accountId: asset.accumulatedDepreciationAccountId, description: `Remove accumulated depreciation — ${asset.name}`, debit: new Prisma.Decimal(calculation.accumulatedDepreciation), credit: zero }] : []),
      ...(calculation.loss > 0 ? [{ accountId: input.lossAccountId!, description: `Loss on disposal — ${asset.name}`, debit: new Prisma.Decimal(calculation.loss), credit: zero }] : []),
      { accountId: asset.assetAccountId, description: `Remove asset cost — ${asset.name}`, debit: zero, credit: new Prisma.Decimal(asset.originalCost) },
      ...(calculation.gain > 0 ? [{ accountId: input.gainAccountId!, description: `Gain on disposal — ${asset.name}`, debit: zero, credit: new Prisma.Decimal(calculation.gain) }] : []),
    ];
    const reference = `DISP-${asset.assetCode}-${input.disposalDate.toISOString().slice(0, 10).replaceAll("-", "")}`;
    const journal = await tx.journal.create({ data: { tenantId: active.id, periodId: period.id, reference, description: input.reason, accountingDate: input.disposalDate, status: "POSTED", source: "FIXED_ASSET_DISPOSAL", createdById: user.id, approvedById: user.id, postedById: user.id, postedAt: new Date(), lines: { create: lines } } });
    const disposal = await tx.fixedAssetDisposal.create({ data: { tenantId: active.id, fixedAssetId: asset.id, periodId: period.id, disposalDate: input.disposalDate, proceeds: input.proceeds, accumulatedDepreciation: calculation.accumulatedDepreciation, netBookValue: calculation.netBookValue, gainLoss: calculation.gainLoss, proceedsAccountId: input.proceedsAccountId, gainAccountId: input.gainAccountId || null, lossAccountId: input.lossAccountId || null, journalId: journal.id, reason: input.reason, createdById: user.id } });
    await tx.journal.update({ where: { id: journal.id }, data: { sourceId: disposal.id } });
    await tx.fixedAsset.update({ where: { id: asset.id }, data: { status: "DISPOSED", disposedOn: input.disposalDate, disposalProceeds: input.proceeds } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_DISPOSED", entityType: "FixedAsset", entityId: asset.id, newValues: { disposalDate: input.disposalDate, proceeds: input.proceeds, netBookValue: calculation.netBookValue, gainLoss: calculation.gainLoss, journalId: journal.id }, reason: input.reason } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const message = error instanceof Error && !error.message.includes("Invalid `") ? error.message : "The disposal could not be posted. Review the asset and account selections, then try again.";
    redirect(`/fixed-assets/disposals/new?asset=${encodeURIComponent(input.fixedAssetId)}&error=${encodeURIComponent(message)}`);
  }
  redirect("/fixed-assets/disposals");
}
