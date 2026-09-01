import { describe, expect, it } from "vitest";
import { deriveOpeningChecklist } from "./opening-checklist";

const complete = () => deriveOpeningChecklist({ hasOpeningJournal: true, receivables: { reconciled: true, supportingAmount: 100 }, payables: { reconciled: true, supportingAmount: 50 }, inventoryItemCount: 2, openingInventoryCount: 2, fixedAssetAccountCount: 2, fixedAssetCount: 3, activeEmployeeCount: 2, openingPayrollCount: 2 });

describe("new-client opening checklist", () => {
  it("is complete when every applicable opening register is populated and tied out", () => expect(complete().complete).toBe(true));
  it("shows a partially allocated subledger", () => {
    const result = deriveOpeningChecklist({ hasOpeningJournal: true, receivables: { reconciled: false, supportingAmount: 25 }, payables: { reconciled: true, supportingAmount: 0 }, inventoryItemCount: 0, openingInventoryCount: 0, fixedAssetAccountCount: 0, fixedAssetCount: 0, activeEmployeeCount: 0, openingPayrollCount: 0 });
    expect(result.items.find((item) => item.key === "AR")?.status).toBe("PARTIAL");
    expect(result.complete).toBe(false);
  });
  it("marks unconfigured operational registers not applicable", () => {
    const result = deriveOpeningChecklist({ hasOpeningJournal: true, receivables: { reconciled: true, supportingAmount: 0 }, payables: { reconciled: true, supportingAmount: 0 }, inventoryItemCount: 0, openingInventoryCount: 0, fixedAssetAccountCount: 0, fixedAssetCount: 0, activeEmployeeCount: 0, openingPayrollCount: 0 });
    expect(result.items.filter((item) => ["INVENTORY", "FIXED_ASSETS", "PAYROLL"].includes(item.key)).every((item) => item.status === "NOT_APPLICABLE")).toBe(true);
  });
});
