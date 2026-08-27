"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";

type Party = { id: string; code: string; name: string; currencyCode: string };
type Period = { id: string; name: string };
type Account = { id: string; code: string; name: string };
type Document = { id: string; partyId: string; reference: string; date: string; currency: string; outstanding: string };

export function SettlementForm({ kind, action, parties, accounts, documents }: { kind: "receipt" | "payment"; action: (f: FormData) => Promise<void>; parties: Party[]; periods: Period[]; accounts: Account[]; documents: Document[] }) {
  const receipt = kind === "receipt";
  const [partyId, setPartyId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const visible = documents.filter((document) => document.partyId === partyId);
  const currency = parties.find((party) => party.id === partyId)?.currencyCode ?? "BND";
  const total = useMemo(() => visible.reduce((sum, document) => sum + (Number(amounts[document.id]) || 0), 0), [visible, amounts]);

  return <form action={action} className="form-panel">
    <section className="form-section"><div className="section-heading"><h2>{receipt ? "Customer receipt" : "Supplier payment"}</h2><p>Allocate one settlement across one or more open documents. Partial settlement is supported.</p></div><div className="form-grid">
      <label>{receipt ? "Customer" : "Supplier"}<select name="partyId" value={partyId} onChange={(event) => { setPartyId(event.target.value); setAmounts({}); }} required><option value="">Select party</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.code} — {party.name} ({party.currencyCode})</option>)}</select></label>
      <AutoReferenceField example={receipt ? "RC-2026-0001" : "SP-2026-0001"} />
      <label>{receipt ? "Receipt" : "Payment"} date<input name="settlementDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
      <label>Cash or bank account<select name="bankAccountId" required><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
      {!receipt && <><label>Payment method <em>*</em><select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required><option value="BANK_TRANSFER">Bank transfer</option><option value="BANK_CHEQUE">Bank cheque</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>{paymentMethod === "BANK_CHEQUE" && <><label>Cheque number <em>*</em><input name="chequeNumber" maxLength={60} required /></label><label>Cheque date <em>*</em><input name="chequeDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><p className="form-help">The cheque can be marked Cleared or Returned after posting.</p></>}</>}
    </div></section>
    <section className="form-section"><div className="section-heading"><h2>Document allocation</h2><p>Enter the amount in {currency}. Leave unrelated documents blank.</p></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Currency</th><th className="numeric">Outstanding</th><th className="numeric">Allocate</th></tr></thead><tbody>
      {visible.map((document) => <tr key={document.id}><td><strong>{document.reference}</strong><input type="hidden" name="documentId" value={document.id} /></td><td>{document.date}</td><td>{document.currency}</td><td className="numeric">{document.currency} {Number(document.outstanding).toFixed(2)}</td><td className="numeric"><input name="allocationAmount" value={amounts[document.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="0.00" /></td></tr>)}
      {!partyId && <tr><td colSpan={5}>Select a party to view open documents.</td></tr>}{partyId && !visible.length && <tr><td colSpan={5}>No open documents for this party.</td></tr>}
    </tbody></table></div><div className="document-total"><span>Documents selected <strong>{visible.filter((document) => Number(amounts[document.id]) > 0).length}</strong></span><span className="grand-total">Settlement total <strong>{currency} {total.toFixed(2)}</strong></span></div></section>
    <div className="form-actions"><Link href={receipt ? "/receipts" : "/payments"} className="button-secondary">Cancel</Link><button className="button-primary">Post {receipt ? "receipt" : "payment"}</button></div>
  </form>;
}
