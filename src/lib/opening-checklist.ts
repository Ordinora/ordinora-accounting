export type OpeningChecklistStatus = "COMPLETE" | "PARTIAL" | "NOT_STARTED" | "NOT_APPLICABLE";
export type OpeningChecklistItem = { key: string; label: string; status: OpeningChecklistStatus; detail: string; href: string };

type ReconciliationInput = { reconciled: boolean; supportingAmount: number };
export function deriveOpeningChecklist(input: {
  hasOpeningJournal: boolean;
  receivables: ReconciliationInput;
  payables: ReconciliationInput;
  inventoryItemCount: number;
  openingInventoryCount: number;
  fixedAssetAccountCount: number;
  fixedAssetCount: number;
  activeEmployeeCount: number;
  openingPayrollCount: number;
}) {
  const subledgerStatus = (item: ReconciliationInput): OpeningChecklistStatus => item.reconciled ? "COMPLETE" : item.supportingAmount > 0 ? "PARTIAL" : "NOT_STARTED";
  const items: OpeningChecklistItem[] = [
    { key: "GL", label: "GL opening balance", status: input.hasOpeningJournal ? "COMPLETE" : "NOT_STARTED", detail: input.hasOpeningJournal ? "The opening general-ledger journal is posted." : "Post the conversion-date statement of financial position.", href: "/settings/opening-balances" },
    { key: "AR", label: "Opening receivables", status: input.hasOpeningJournal ? subledgerStatus(input.receivables) : "NOT_STARTED", detail: input.receivables.reconciled ? "Customer opening documents agree with the receivables control balance." : input.receivables.supportingAmount > 0 ? "Customer documents are entered but do not yet agree with the control balance." : "Allocate the receivables control balance to customer documents.", href: "/settings/opening-subledgers" },
    { key: "AP", label: "Opening payables", status: input.hasOpeningJournal ? subledgerStatus(input.payables) : "NOT_STARTED", detail: input.payables.reconciled ? "Supplier opening documents agree with the payables control balance." : input.payables.supportingAmount > 0 ? "Supplier documents are entered but do not yet agree with the control balance." : "Allocate the payables control balance to supplier documents.", href: "/settings/opening-subledgers" },
    { key: "INVENTORY", label: "Opening inventory", status: input.inventoryItemCount === 0 ? "NOT_APPLICABLE" : input.openingInventoryCount > 0 ? "COMPLETE" : "NOT_STARTED", detail: input.inventoryItemCount === 0 ? "No active inventory items are configured." : input.openingInventoryCount > 0 ? "Opening inventory movements have been recorded." : "Inventory items exist but no opening quantities have been posted.", href: "/inventory/opening" },
    { key: "FIXED_ASSETS", label: "Opening fixed assets", status: input.fixedAssetAccountCount === 0 ? "NOT_APPLICABLE" : input.fixedAssetCount > 0 ? "COMPLETE" : "NOT_STARTED", detail: input.fixedAssetAccountCount === 0 ? "No fixed-asset ledger accounts are configured." : input.fixedAssetCount > 0 ? "The opening fixed-asset register contains assets." : "Fixed-asset accounts exist but no opening assets have been imported.", href: "/fixed-assets/import" },
    { key: "PAYROLL", label: "Opening payroll YTD", status: input.activeEmployeeCount === 0 ? "NOT_APPLICABLE" : input.openingPayrollCount >= input.activeEmployeeCount ? "COMPLETE" : "NOT_STARTED", detail: input.activeEmployeeCount === 0 ? "No active employees are configured." : input.openingPayrollCount >= input.activeEmployeeCount ? "Opening YTD figures are recorded for every active employee." : `${input.openingPayrollCount} of ${input.activeEmployeeCount} active employees have opening YTD figures.`, href: "/settings/opening-payroll" },
  ];
  return { items, complete: items.every((item) => item.status === "COMPLETE" || item.status === "NOT_APPLICABLE") };
}
