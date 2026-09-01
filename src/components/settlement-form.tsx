"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";

type Party = { id: string; code: string; name: string; currencyCode: string };
type Period = { id: string; name: string };
type Account = { id: string; code: string; name: string };
type Document = { id: string; partyId: string; reference: string; date: string; currency: string; outstanding: string };

function liveDiscount(input: string, outstanding: number) {
  const value = input.trim();
  if (!value) return { amount: 0, error: "" };
  const symbols = [...value].filter((character) => character === "%").length;
  if (symbols) {
    if (symbols !== 1 || !/^\d+(\.\d{1,4})?\s*%$/.test(value)) return { amount: 0, error: "Use a format such as 5% or 2.5%." };
    const percentage = Number(value.replace("%", "").trim());
    if (percentage < 0 || percentage > 100) return { amount: 0, error: "Percentage must be between 0% and 100%." };
    return { amount: Math.round(outstanding * percentage) / 100, error: "" };
  }
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(\.\d{1,2})?$/.test(value)) return { amount: 0, error: "Enter a fixed amount or percentage." };
  const amount = Number(value.replaceAll(",", ""));
  if (amount > outstanding) return { amount: 0, error: "Discount exceeds outstanding." };
  return { amount, error: "" };
}

export function SettlementForm({ kind, action, parties, accounts, documents }: { kind: "receipt" | "payment"; action: (f: FormData) => Promise<void>; parties: Party[]; periods: Period[]; accounts: Account[]; documents: Document[] }) {
  const receipt = kind === "receipt";
  const [partyId, setPartyId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const visible = documents.filter((document) => document.partyId === partyId);
  const currency = parties.find((party) => party.id === partyId)?.currencyCode ?? "BND";
  const rows = useMemo(() => visible.map((document) => {
    const outstanding = Number(document.outstanding);
    const discount = receipt ? { amount: 0, error: "" } : liveDiscount(discounts[document.id] ?? "", outstanding);
    const paid = Number(amounts[document.id]) || 0;
    const settled = paid + discount.amount;
    return { document, outstanding, discount, paid, settled, remaining: Math.max(0, outstanding - settled), over: settled > outstanding + 0.00001 };
  }), [visible, amounts, discounts, receipt]);
  const cashTotal = rows.reduce((sum, row) => sum + row.paid, 0);
  const discountTotal = rows.reduce((sum, row) => sum + row.discount.amount, 0);
  const settlementTotal = cashTotal + discountTotal;

  const changeDiscount = (document: Document, input: string) => {
    const calculated = liveDiscount(input, Number(document.outstanding));
    setDiscounts((current) => ({ ...current, [document.id]: input }));
    if (!calculated.error) {
      const fullCash = Math.max(0, Number(document.outstanding) - calculated.amount);
      setAmounts((current) => ({ ...current, [document.id]: fullCash.toFixed(2) }));
    }
  };

  return <form action={action} className="form-panel">
    <section className="form-section"><div className="section-heading"><h2>{receipt ? "Customer receipt" : "Supplier payment"}</h2><p>Allocate one settlement across one or more open documents. Partial settlement is supported.</p></div><div className="form-grid">
      <label>{receipt ? "Customer" : "Supplier"}<select name="partyId" value={partyId} onChange={(event) => { setPartyId(event.target.value); setAmounts({}); setDiscounts({}); }} required><option value="">Select party</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.code} — {party.name} ({party.currencyCode})</option>)}</select></label>
      <AutoReferenceField example={receipt ? "RC-2026-0001" : "SP-2026-0001"} />
      <label>{receipt ? "Receipt" : "Payment"} date<input name="settlementDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
      <label>Cash or bank account<select name="bankAccountId" required><option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
      {!receipt && <><label>Payment method <em>*</em><select name="paymentMethod" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} required><option value="BANK_TRANSFER">Bank transfer</option><option value="BANK_CHEQUE">Bank cheque</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>{paymentMethod === "BANK_CHEQUE" && <><label>Cheque number <em>*</em><input name="chequeNumber" maxLength={60} required /></label><label>Cheque date <em>*</em><input name="chequeDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><p className="form-help">The cheque can be marked Cleared or Returned after posting.</p></>}</>}
    </div></section>
    <section className="form-section settlement-allocation-section"><div className="section-heading"><h2>Document allocation</h2><p>{receipt ? `Enter the amount in ${currency}. Leave unrelated documents blank.` : "Enter one fixed discount or percentage per invoice. The amount paid remains editable for a partial settlement."}</p></div><div className="data-table-wrap"><table className="data-table settlement-table"><thead><tr><th>Reference</th><th>Date</th><th className="numeric">Outstanding</th>{!receipt && <><th className="numeric">Discount</th><th className="numeric">Discount amount</th></>}<th className="numeric">{receipt ? "Allocate" : "Amount paid"}</th>{!receipt && <><th className="numeric">Total settled</th><th className="numeric">Remaining</th></>}</tr></thead><tbody>
      {rows.map(({ document, outstanding, discount, settled, remaining, over }) => <tr key={document.id}><td><strong>{document.reference}</strong><input type="hidden" name="documentId" value={document.id} /></td><td>{document.date}</td><td className="numeric">{document.currency} {outstanding.toFixed(2)}</td>{!receipt && <><td className="numeric"><input name="discountInput" value={discounts[document.id] ?? ""} onChange={(event) => changeDiscount(document, event.target.value)} placeholder="5% or 50.00" aria-invalid={Boolean(discount.error)} />{discount.error && <small className="field-error">{discount.error}</small>}</td><td className="numeric">{document.currency} {discount.amount.toFixed(2)}</td></>}<td className="numeric"><input name="allocationAmount" value={amounts[document.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="0.00" inputMode="decimal" /></td>{!receipt && <><td className="numeric">{document.currency} {settled.toFixed(2)}</td><td className={`numeric${over ? " field-error" : ""}`}>{over ? "Exceeds outstanding" : `${document.currency} ${remaining.toFixed(2)}`}</td></>}</tr>)}
      {!partyId && <tr><td colSpan={receipt ? 4 : 8}>Select a party to view open documents.</td></tr>}{partyId && !visible.length && <tr><td colSpan={receipt ? 4 : 8}>No open documents for this party.</td></tr>}
    </tbody></table></div><div className="document-total settlement-totals"><span>Documents selected <strong>{rows.filter((row) => row.settled > 0).length}</strong></span>{!receipt && <><span>Discount <strong>{currency} {discountTotal.toFixed(2)}</strong></span><span>Cash paid <strong>{currency} {cashTotal.toFixed(2)}</strong></span></>}<span className="grand-total">Total settled <strong>{currency} {settlementTotal.toFixed(2)}</strong></span></div></section>
    <div className="form-actions"><Link href={receipt ? "/receipts" : "/payments"} className="button-secondary">Cancel</Link><button className="button-primary">Post {receipt ? "receipt" : "payment"}</button></div>
  </form>;
}
