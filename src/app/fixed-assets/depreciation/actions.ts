"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { calculateFixedAssetBookValue } from "@/lib/fixed-assets";
import { requireActiveTenant } from "@/lib/session";

export async function postDepreciationRun(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  if (!user.staffRole || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT"].includes(user.staffRole)) throw new Error("Your role cannot post depreciation.");
  const input = z.object({ depreciationDate: z.coerce.date() }).parse(Object.fromEntries(formData));
  const date = input.depreciationDate.toISOString().slice(0, 10);
  const period = await db.accountingPeriod.findFirst({ where: { tenantId: active.id, status: "OPEN", startsOn: { lte: input.depreciationDate }, endsOn: { gte: input.depreciationDate } }, orderBy: { startsOn: "desc" } });
  if (!period) redirect(`/fixed-assets/depreciation?asOf=${date}&error=${encodeURIComponent("This date is in a closed or unavailable accounting period. Open the period under Administration → Accounting periods, then try again.")}`);

  const result = await db.$transaction(async (transaction) => {
    const assets = await transaction.fixedAsset.findMany({ where: { tenantId: active.id, status: "ACTIVE", acquiredOn: { lte: input.depreciationDate } }, include: { depreciationEntries: { where: { depreciationDate: { lte: input.depreciationDate } } } } });
    let posted = 0;
    let total = new Prisma.Decimal(0);
    for (const asset of assets) {
      const scheduled = calculateFixedAssetBookValue({ originalCost: Number(asset.originalCost), residualValue: Number(asset.residualValue), openingAccumulatedDepreciation: Number(asset.openingAccumulatedDepreciation), usefulLifeMonths: asset.usefulLifeMonths, depreciationStartsOn: asset.depreciationStartsOn, asOf: input.depreciationDate });
      const already = asset.depreciationEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);
      const due = new Prisma.Decimal(Math.max(0, scheduled.accumulatedDepreciation - Number(asset.openingAccumulatedDepreciation) - already)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      if (due.lte(0)) continue;
      const reference = `DEP-${asset.assetCode}-${date.slice(0, 7).replace("-", "")}`;
      if (await transaction.fixedAssetDepreciation.count({ where: { fixedAssetId: asset.id, depreciationDate: input.depreciationDate } })) continue;
      const journal = await transaction.journal.create({ data: { tenantId: active.id, periodId: period.id, reference, description: `Book depreciation — ${asset.name}`, accountingDate: input.depreciationDate, status: "POSTED", source: "FIXED_ASSET_DEPRECIATION", createdById: user.id, approvedById: user.id, postedById: user.id, postedAt: new Date(), lines: { create: [{ accountId: asset.depreciationExpenseAccountId, description: `Depreciation — ${asset.name}`, debit: due, credit: new Prisma.Decimal(0) }, { accountId: asset.accumulatedDepreciationAccountId, description: `Accumulated depreciation — ${asset.name}`, debit: new Prisma.Decimal(0), credit: due }] } } });
      const entry = await transaction.fixedAssetDepreciation.create({ data: { tenantId: active.id, fixedAssetId: asset.id, periodId: period.id, depreciationDate: input.depreciationDate, amount: due, journalId: journal.id, createdById: user.id } });
      await transaction.journal.update({ where: { id: journal.id }, data: { sourceId: entry.id } });
      posted += 1;
      total = total.add(due);
    }
    await transaction.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "FIXED_ASSET_DEPRECIATION_RUN_POSTED", entityType: "FixedAssetDepreciation", entityId: date, newValues: { posted, total: total.toString(), periodId: period.id } } });
    return { posted, total: total.toString() };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const message = result.posted ? `${result.posted} depreciation entries posted (${active.defaultCurrency} ${result.total}).` : "No depreciation was due. All active assets are already current through this date.";
  redirect(`/fixed-assets/depreciation?asOf=${date}&success=${encodeURIComponent(message)}`);
}
