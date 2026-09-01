import "server-only";
import { Prisma } from "@prisma/client";

const preferredNames = ["Purchase Discounts Received", "Purchase Discount", "Supplier Discount", "Discounts Received"];

/** Reuses a configured supplier-discount account and creates a standard one only when none exists. */
export async function requirePurchaseDiscountAccount(tx: Prisma.TransactionClient, tenantId: string) {
  const matches = await tx.account.findMany({
    where: {
      tenantId,
      OR: preferredNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
    },
    orderBy: { code: "asc" },
  });
  if (matches[0]) {
    if (!matches[0].isActive) throw new Error(`${matches[0].name} is inactive. Activate it in the chart of accounts before posting this supplier discount.`);
    if (matches[0].isControlAccount || !["REVENUE", "EXPENSE"].includes(matches[0].type)) throw new Error(`${matches[0].name} is not configured as a valid revenue or contra-purchase account.`);
    return matches[0];
  }

  const reserved = new Set((await tx.account.findMany({ where: { tenantId, code: { startsWith: "43" } }, select: { code: true } })).map((account) => account.code));
  const code = Array.from({ length: 80 }, (_, index) => String(4320 + index)).find((candidate) => !reserved.has(candidate));
  if (!code) throw new Error("No account code is available for Purchase Discounts Received. Create an appropriate active revenue account first.");
  return tx.account.create({
    data: { tenantId, code, name: preferredNames[0], type: "REVENUE", reportingClassification: "Other Income", isActive: true, isControlAccount: false },
  });
}
