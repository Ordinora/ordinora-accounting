import { describe, expect, it } from "vitest";
import { isPermittedPurchaseAccount } from "./purchase-account-policy";

describe("purchase account policy", () => {
  it("allows expense and fixed-asset accounts", () => {
    expect(isPermittedPurchaseAccount({ type: "EXPENSE", code: "6600" })).toBe(true);
    expect(isPermittedPurchaseAccount({ type: "ASSET", code: "1500" })).toBe(true);
  });

  it.each(["1000", "1100", "1110", "1200", "1300"])("blocks protected asset account %s", (code) => {
    expect(isPermittedPurchaseAccount({ type: "ASSET", code })).toBe(false);
  });

  it("blocks revenue and liability accounts", () => {
    expect(isPermittedPurchaseAccount({ type: "REVENUE", code: "4000" })).toBe(false);
    expect(isPermittedPurchaseAccount({ type: "LIABILITY", code: "2000" })).toBe(false);
  });

  it("blocks custom cash and inventory-control accounts without relying on their codes", () => {
    expect(isPermittedPurchaseAccount({ type: "ASSET", code: "A-001", reportingClassification: "Cash and cash equivalents" })).toBe(false);
    expect(isPermittedPurchaseAccount({ type: "ASSET", code: "A-002", _count: { inventoryAssetItems: 2 } })).toBe(false);
    expect(isPermittedPurchaseAccount({ type: "ASSET", code: "A-003", isControlAccount: true })).toBe(false);
  });

  it("allows a custom non-control fixed-asset account", () => {
    expect(isPermittedPurchaseAccount({ type: "ASSET", code: "FA-FREEZER", reportingClassification: "Non-current assets", _count: { inventoryAssetItems: 0 } })).toBe(true);
  });
});
