import Link from "next/link";
import { notFound } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { updateReceipt, updateSupplierPayment } from "@/app/settlements/actions";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";

export async function SettlementEditPage({ kind, id }: { kind: "receipt" | "supplier-payment"; id: string }) {
  const { user, tenants, active } = await requireActiveTenant();
  const isReceipt = kind === "receipt";
  const raw = isReceipt
    ? await db.customerReceipt.findFirst({ where: { id, tenantId: active.id }, include: { customer: true, bankAccount: true, allocations: { include: { invoice: true } }, lines: { include: { account: true } } } })
    : await db.supplierPayment.findFirst({ where: { id, tenantId: active.id }, include: { supplier: true, bankAccount: true, allocations: { include: { bill: true } } } });
  if (!raw) notFound();
  const party = "customer" in raw ? raw.customer ? `${raw.customer.code} — ${raw.customer.name}` : raw.payerName ?? "Other payer" : `${raw.supplier.code} — ${raw.supplier.name}`;
  const date = "receiptDate" in raw ? raw.receiptDate : raw.paymentDate;
  const allocations = "customer" in raw ? raw.allocations.map((a) => ({ id: a.id, reference: a.invoice.reference, amount: a.foreignAmount, discountInput: a.discountInput, discount: a.discountForeignAmount, cash: a.foreignAmount.sub(a.discountForeignAmount) })) : raw.allocations.map((a) => ({ id: a.id, reference: a.bill.reference, amount: a.foreignAmount, discountInput: a.discountInput, discount: a.discountForeignAmount, cash: a.foreignAmount.sub(a.discountForeignAmount) }));
  const lines = "customer" in raw ? raw.lines.map((line) => ({ id: line.id, reference: `${line.account.code} — ${line.description}`, amount: line.foreignAmount, discountInput: null, discount: 0, cash: line.foreignAmount })) : [];
  const details = allocations.length ? allocations : lines;
  const action = isReceipt ? updateReceipt : updateSupplierPayment;
  return <AppShell user={{ displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name }} tenants={tenants} activeTenant={active} pageTitle={`${isReceipt ? "Receipt" : "Supplier payment"} ${raw.reference}`} pageDescription="View and update the connected settlement">
    <main className="module-page form-page"><form action={action} className="form-panel"><input type="hidden" name="id" value={raw.id} />
      <section className="form-section"><div className="section-heading"><h2>Settlement details</h2><p>The reference updates the settlement and its journal together.</p></div><div className="form-grid">
        <label>{isReceipt ? "Paid by" : "Supplier"}<input value={party} readOnly /></label><label>Reference<input name="reference" required defaultValue={raw.reference} /></label><label>Date<input type="date" value={date.toISOString().slice(0, 10)} readOnly /></label><label>Cash / bank account<input value={`${raw.bankAccount.code} — ${raw.bankAccount.name}`} readOnly /></label><label>{isReceipt ? "Cash received" : "Cash paid"}<input value={`${raw.currency} ${Number(raw.foreignAmount).toFixed(2)}`} readOnly /></label>{raw.allocations.length > 0 && <><label>{isReceipt ? "Sales discount" : "Supplier discount"}<input value={`${raw.currency} ${Number(raw.discountForeignAmount).toFixed(2)}`} readOnly /></label><label>Total settled<input value={`${raw.currency} ${Number(raw.foreignAmount.add(raw.discountForeignAmount)).toFixed(2)}`} readOnly /></label></>}<label>Reason for update<input name="reason" required minLength={5} maxLength={240} /></label>
      </div></section>
      <section className="form-section"><div className="section-heading"><h2>{allocations.length ? "Invoice allocations" : "Line items"}</h2><p>Posted financial values are read-only because changing them requires reversing and rebuilding the balanced journal.</p></div>{details.map((detail) => <div key={detail.id} className="statement-grand-total"><span>{detail.reference}{detail.discountInput ? ` · Discount ${detail.discountInput}` : ""}</span><strong>{Number(detail.discount) > 0 ? `${isReceipt ? "Received" : "Paid"} ${raw.currency} ${Number(detail.cash).toFixed(2)} + discount ${raw.currency} ${Number(detail.discount).toFixed(2)} = ` : ""}{raw.currency} {Number(detail.amount).toFixed(2)}</strong></div>)}</section>
      <div className="form-actions"><Link href={isReceipt ? "/receipts" : "/payments"} className="button-secondary">Cancel</Link><button className="button-primary"><Save size={15} />Save update</button>{raw.journalId && <Link href={`/journals/${raw.journalId}#delete-transaction`} className="button-danger"><Trash2 size={15} />Delete</Link>}</div>
    </form></main>
  </AppShell>;
}
