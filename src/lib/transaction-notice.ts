export const transactionNoticeMessages = {
  "sales-invoice": "Sales invoice posted successfully.",
  "purchase-invoice": "Purchase invoice posted successfully.",
  payment: "Payment posted successfully.",
  receipt: "Receipt posted successfully.",
  "manual-journal": "Journal posted successfully.",
  "credit-note": "Credit note posted successfully.",
  "cash-sale": "Cash sale posted successfully.",
  "cheque-cleared": "Bank cheque marked as cleared.",
  "cheque-returned": "Returned cheque transaction posted successfully.",
  transfer: "Inter-account transfer posted successfully.",
  "inventory-transfer": "Inventory transfer posted successfully.",
  "inventory-adjustment": "Inventory adjustment posted successfully.",
  "inventory-opening": "Opening inventory posted successfully.",
  "inventory-consumption": "Inventory consumption posted successfully.",
  "opening-balances": "Opening balances posted successfully.",
  "fixed-asset-disposal": "Fixed asset disposal posted successfully.",
  "payroll-run": "Payroll run posted successfully.",
  "payroll-payment": "Payroll payment posted successfully.",
  reconciliation: "Bank reconciliation finalized successfully.",
} as const;

export type TransactionNoticeCode = keyof typeof transactionNoticeMessages;

export function withTransactionNotice(path: string, code: TransactionNoticeCode) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}posted=${encodeURIComponent(code)}`;
}
