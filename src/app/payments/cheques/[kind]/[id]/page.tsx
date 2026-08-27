import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { clearCheque, returnCheque } from "@/app/payments/cheques/actions";

export const dynamic = "force-dynamic";
export default async function ChequePage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (!['direct', 'supplier'].includes(kind)) notFound();
  const chequeKind = kind === "direct" ? "DIRECT" : "SUPPLIER";
  const { user, tenants, active } = await requireActiveTenant();
  const payment = chequeKind === "DIRECT"
    ? await db.payment.findFirst({ where: { id, tenantId: active.id }, include: { bankAccount: true } })
    : await db.supplierPayment.findFirst({ where: { id, tenantId: active.id }, include: { bankAccount: true, supplier: true, allocations: { include: { bill: true } } } });
  if (!payment || payment.paymentMethod !== "BANK_CHEQUE") notFound();
  const liabilities = chequeKind === "DIRECT" ? await db.account.findMany({ where: { tenantId: active.id, type: "LIABILITY", isActive: true, isControlAccount: false }, orderBy: { code: "asc" } }) : [];
  const defaultLiability = liabilities.find((account) => account.code === "2200")?.id ?? liabilities[0]?.id;
  const payee = "supplier" in payment ? payment.supplier.name : payment.payee;
  const today = new Date().toISOString().slice(0, 10);
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={`Cheque ${payment.chequeNumber}`} pageDescription="Track cheque clearance or record a returned cheque">
    <main className="module-page"><header className="module-header"><div><p className="eyebrow">{payee.toUpperCase()}</p><h2>Bank cheque {payment.chequeNumber}</h2><p>The original payment remains visible for audit. A returned cheque creates the correcting journal automatically.</p></div><span className="status-pill">{payment.chequeStatus ?? "ISSUED"}</span></header>
      <section className="surface-card"><div className="report-summary-grid"><div><span>Reference</span><strong>{payment.reference}</strong></div><div><span>Cheque date</span><strong>{payment.chequeDate?.toLocaleDateString("en-BN")}</strong></div><div><span>Bank account</span><strong>{payment.bankAccount.code} — {payment.bankAccount.name}</strong></div><div><span>Amount</span><strong>{payment.currency} {Number(payment.foreignAmount).toFixed(2)}</strong></div></div></section>
      {payment.chequeStatus === "RETURNED" ? <section className="surface-card"><h3>Cheque returned</h3><p>{payment.chequeReturnReason}</p><p>Returned on {payment.chequeReturnedOn?.toLocaleDateString("en-BN")}. The bank balance and connected payable position have been corrected.</p>{payment.chequeReturnJournalId && <Link className="button-secondary" href={`/journals/${payment.chequeReturnJournalId}`}>View return journal</Link>}</section> : <div className="settings-grid">
        <form action={clearCheque} className="surface-card compact-form-body"><h3>Mark cheque cleared</h3><p>Use this when the cheque has cleared the bank.</p><input type="hidden" name="kind" value={chequeKind}/><input type="hidden" name="id" value={payment.id}/><label>Cleared date<input type="date" name="clearedOn" defaultValue={today} required/></label><button className="button-secondary">Mark cleared</button></form>
        <form action={returnCheque} className="surface-card compact-form-body"><h3>Mark cheque returned</h3><p>{chequeKind === "SUPPLIER" ? "The supplier bills allocated to this cheque will be reopened." : "The original purchase remains recorded and the unpaid amount moves to the selected liability account."}</p><input type="hidden" name="kind" value={chequeKind}/><input type="hidden" name="id" value={payment.id}/><label>Return date<input type="date" name="returnedOn" defaultValue={today} required/></label>{chequeKind === "DIRECT" && <label>Amount still payable<select name="liabilityAccountId" defaultValue={defaultLiability} required>{liabilities.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>}<label>Return reason<textarea name="reason" minLength={5} maxLength={500} placeholder="For example: insufficient funds or signature mismatch" required/></label><button className="button-danger">Mark returned and correct accounts</button></form>
      </div>}
      <div className="form-actions"><Link className="button-secondary" href="/payments">Back to payments</Link></div>
    </main>
  </AppShell>;
}
