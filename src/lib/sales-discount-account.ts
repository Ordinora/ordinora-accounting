import "server-only";
import { Prisma } from "@prisma/client";

const preferredNames = ["Sales discounts", "Sales Discount", "Customer Discount", "Discounts Allowed"];

/** Reuses the configured contra-revenue account and creates a standard one only when none exists. */
export async function requireSalesDiscountAccount(tx: Prisma.TransactionClient, tenantId: string) {
  const matches = await tx.account.findMany({ where: { tenantId, OR: preferredNames.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })) }, orderBy: { code: "asc" } });
  if (matches[0]) {
    if (!matches[0].isActive) throw new Error(`${matches[0].name} is inactive. Activate it in the chart of accounts before posting this sales discount.`);
    if (matches[0].isControlAccount || matches[0].type !== "REVENUE") throw new Error(`${matches[0].name} is not configured as a valid contra-revenue account.`);
    return matches[0];
  }
  const reserved = new Set((await tx.account.findMany({ where: { tenantId, code: { startsWith: "406" } }, select: { code: true } })).map((account) => account.code));
  const code = Array.from({ length: 10 }, (_, index) => String(4060 + index)).find((candidate) => !reserved.has(candidate));
  if (!code) throw new Error("No account code is available for Sales Discounts. Create an active contra-revenue account first.");
  return tx.account.create({ data: { tenantId, code, name: preferredNames[0], type: "REVENUE", reportingClassification: "Contra Revenue", isActive: true, isControlAccount: false } });
}
