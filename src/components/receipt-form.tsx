"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";
import { QuickContactButton } from "@/components/quick-contact";

type Customer = { id: string; code: string; name: string; currencyCode: string };
type Option = { id: string; code: string; name: string };
type Document = { id: string; partyId: string; reference: string; date: string; currency: string; outstanding: string };
type Line = { id: number; description: string; accountId: string; quantity: string; unitPrice: string };
const emptyLine = (id: number): Line => ({ id, description: "", accountId: "", quantity: "1", unitPrice: "" });

export function ReceiptForm({ action, customers: initialCustomers, bankAccounts, postingAccounts, documents, currencies, defaultCurrency }: {
  action: (data: FormData) => Promise<void>;
  customers: Customer[];
  bankAccounts: Option[];
  postingAccounts: Option[];
  documents: Document[];
  currencies: string[];
  defaultCurrency: string;
}) {
  const [mode, setMode] = useState<"LINES" | "INVOICES">("LINES");
  const [payerType, setPayerType] = useState<"CUSTOMER" | "OTHER">("CUSTOMER");
  const [customers, setCustomers] = useState(initialCustomers);
  const [customerId, setCustomerId] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [lines, setLines] = useState<Line[]>([emptyLine(1)]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const visibleDocuments = documents.filter((document) => document.partyId === customerId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const directTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const allocationTotal = useMemo(() => visibleDocuments.reduce((sum, document) => sum + (Number(amounts[document.id]) || 0), 0), [visibleDocuments, amounts]);
  const updateLine = (id: number, field: keyof Omit<Line, "id">, value: string) => setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));

  const changeMode = (next: "LINES" | "INVOICES") => {
    setMode(next);
    if (next === "INVOICES") {
      setPayerType("CUSTOMER");
      setCurrency(selectedCustomer?.currencyCode ?? defaultCurrency);
    }
  };

  return <form action={action} className="form-panel">
    <input type="hidden" name="receiptMode" value={mode} />
    <section className="form-section"><div className="section-heading"><h2>Receipt details</h2><p>Record money received from a customer or another payer. The receipt date selects the accounting period automatically.</p></div>
      <div className="form-grid">
        <label>Receipt type <em>*</em><select value={mode} onChange={(event) => changeMode(event.target.value as "LINES" | "INVOICES")}><option value="LINES">Receipt with line items</option><option value="INVOICES">Settle customer invoice(s)</option></select></label>
        <AutoReferenceField example="RC-2026-0001" />
        <label>Date <em>*</em><input name="settlementDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        <label>Received in <em>*</em><select name="bankAccountId" required><option value="">Select cash or bank account</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
        <label>Paid by <em>*</em><select name="payerType" value={payerType} onChange={(event) => { const next = event.target.value as "CUSTOMER" | "OTHER"; setPayerType(next); if (next === "OTHER") setCustomerId(""); }} disabled={mode === "INVOICES"}><option value="CUSTOMER">Customer</option>{mode === "LINES" && <option value="OTHER">Other</option>}</select>{mode === "INVOICES" && <input type="hidden" name="payerType" value="CUSTOMER" />}</label>
        {payerType === "CUSTOMER" ? <div className="quick-party-field"><label>Customer <em>*</em><select name="partyId" value={customerId} onChange={(event) => { const id = event.target.value; setCustomerId(id); setAmounts({}); const customer = customers.find((entry) => entry.id === id); if (mode === "INVOICES" && customer) setCurrency(customer.currencyCode); }} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} — {customer.name}</option>)}</select></label><QuickContactButton kind="customer" onCreated={(customer) => { const created = { ...customer, currencyCode: defaultCurrency }; setCustomers((current) => [...current, created]); setCustomerId(created.id); }} /></div> : <label>Name of payer <em>*</em><input name="payerName" placeholder="Person or business name" required /></label>}
        {mode === "LINES" && <label>Currency <em>*</em><select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select></label>}
        <label className={mode === "INVOICES" ? "span-2" : ""}>Description<input name="description" placeholder="Purpose of receipt or supporting reference" /></label>
      </div>
    </section>

    {mode === "LINES" ? <section className="form-section"><div className="section-heading line-heading"><div><h2>Line items</h2><p>Allocate the receipt to revenue, other income, liability, equity, or another suitable non-control account.</p></div><button type="button" className="button-secondary" onClick={() => setLines((current) => [...current, emptyLine(Math.max(...current.map((line) => line.id)) + 1)])}><Plus size={15} />Add line</button></div>
      <div className="data-table-wrap"><table className="data-table receipt-allocation-table"><thead><tr><th>Description</th><th>Ledger account</th><th>Qty</th><th>Unit price</th><th className="numeric">Amount</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.id}>
        <td><input name="lineDescription" value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} required /></td>
        <td><select name="lineAccountId" value={line.accountId} onChange={(event) => updateLine(line.id, "accountId", event.target.value)} required><option value="">Select ledger account</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></td>
        <td><input name="lineQuantity" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} required /></td>
        <td><input name="lineUnitPrice" type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} required /></td>
        <td className="numeric">{currency} {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}</td>
        <td><button type="button" className="line-delete" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button></td>
      </tr>)}</tbody></table></div><div className="document-total"><span>Lines <strong>{lines.length}</strong></span><span className="grand-total">Receipt total <strong>{currency} {directTotal.toFixed(2)}</strong></span></div>
    </section> : <section className="form-section"><div className="section-heading"><h2>Invoice allocation</h2><p>Allocate this receipt to one or more open invoices. This reduces receivables and does not record revenue a second time.</p></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Reference</th><th>Date</th><th>Currency</th><th className="numeric">Outstanding</th><th className="numeric">Allocate</th></tr></thead><tbody>
      {visibleDocuments.map((document) => <tr key={document.id}><td><strong>{document.reference}</strong><input type="hidden" name="documentId" value={document.id} /></td><td>{document.date}</td><td>{document.currency}</td><td className="numeric">{document.currency} {Number(document.outstanding).toFixed(2)}</td><td className="numeric"><input name="allocationAmount" type="number" min="0" step="0.01" value={amounts[document.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="0.00" /></td></tr>)}
      {!customerId && <tr><td colSpan={5}>Select a customer to view open invoices.</td></tr>}{customerId && !visibleDocuments.length && <tr><td colSpan={5}>No open invoices for this customer.</td></tr>}
    </tbody></table></div><div className="document-total"><span>Invoices selected <strong>{visibleDocuments.filter((document) => Number(amounts[document.id]) > 0).length}</strong></span><span className="grand-total">Receipt total <strong>{selectedCustomer?.currencyCode ?? defaultCurrency} {allocationTotal.toFixed(2)}</strong></span></div></section>}
    <div className="form-actions"><Link href="/receipts" className="button-secondary">Cancel</Link><button className="button-primary">Post receipt</button></div>
  </form>;
}
