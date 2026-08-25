import type { AccountType } from "@prisma/client";

const legacyProtectedAssetCodes = new Set(["1000", "1100", "1110", "1200", "1300"]);

type PurchaseAccount = {
  type: AccountType;
  code: string;
  reportingClassification?: string;
  isControlAccount?: boolean;
  _count?: { inventoryAssetItems: number };
};

export function isPermittedPurchaseAccount(account: PurchaseAccount) {
  if (account.type === "EXPENSE") return !account.isControlAccount;
  if (account.type !== "ASSET" || account.isControlAccount) return false;
  if (account.reportingClassification?.trim().toLowerCase() === "cash and cash equivalents") return false;
  if ((account._count?.inventoryAssetItems ?? 0) > 0) return false;
  return !legacyProtectedAssetCodes.has(account.code);
}

export const purchaseAccountTypes: AccountType[] = ["EXPENSE", "ASSET"];
