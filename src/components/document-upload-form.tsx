"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { uploadAccountingDocument, type UploadDocumentState } from "@/app/automation/actions";

const types = [
  ["AUTO", "Detect automatically"],
  ["PURCHASE_INVOICE", "Purchase invoice"],
  ["SALES_INVOICE", "Sales invoice"],
  ["RECEIPT", "Receipt"],
  ["EXPENSE_CLAIM", "Expense claim"],
  ["BANK_STATEMENT", "Bank statement"],
  ["DELIVERY_ORDER", "Delivery order"],
  ["CREDIT_NOTE", "Credit note"],
  ["DEBIT_NOTE", "Debit note"],
  ["SUPPLIER_STATEMENT", "Supplier statement"],
  ["OTHER", "Other accounting document"],
] as const;

export function DocumentUploadForm() {
  const [state, action, pending] = useActionState<UploadDocumentState, FormData>(uploadAccountingDocument, {});
  return (
    <form action={action} className="compact-form-body">
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <label>Document type<select name="requestedType" defaultValue="AUTO">{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>PDF or image<input name="document" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required /></label>
      <p className="upload-help">Maximum 10 MB. Files remain private and tenant-isolated.</p>
      <button className="button-primary" disabled={pending}><Upload size={15} />{pending ? "Processing…" : "Upload and process"}</button>
    </form>
  );
}
