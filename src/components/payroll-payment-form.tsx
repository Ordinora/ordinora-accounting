"use client";

import Link from "next/link";
import { useActionState } from "react";
import { postPayrollSettlement, type PayrollPaymentState } from "@/app/payroll/runs/[id]/payments/actions";
import { AutoReferenceField } from "@/components/auto-reference-field";

export function PayrollPaymentForm({ runId, runReference, returnHref, accounts, outstanding, defaultDate }: {
  runId: string;
  runReference: string;
  returnHref: string;
  accounts: { id: string; code: string; name: string }[];
  outstanding: number;
  defaultDate: string;
}) {
  const [state, action, pending] = useActionState<PayrollPaymentState, FormData>(postPayrollSettlement, {});
  return <form action={action} className="surface-card form-panel">
    <input type="hidden" name="runId" value={runId}/>
    <section className="form-section">
      <div className="section-heading"><h2>Payment details</h2><p>The open accounting period is selected automatically from the payment date.</p></div>
      {state.error&&<div className="form-error" role="alert">{state.error}</div>}
      <div className="form-grid">
        <AutoReferenceField label="Reference" example={`PP-${runReference}`}/>
        <label>Payment date<input name="paymentDate" type="date" required defaultValue={defaultDate}/></label>
        <label>Paid from<select name="bankAccountId" required defaultValue=""><option value="" disabled>Select cash or bank</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
        <label>Amount<input name="amount" type="number" min="0.01" max={outstanding} step="0.01" defaultValue={outstanding.toFixed(2)} required/></label>
        <label className="span-2">Notes<input name="notes" maxLength={500}/></label>
      </div>
    </section>
    <div className="form-actions"><Link href={returnHref} className="button-secondary">Cancel</Link><button className="button-primary" disabled={pending||outstanding<=0||!accounts.length}>{pending?"Posting…":"Post payroll payment"}</button></div>
  </form>;
}
