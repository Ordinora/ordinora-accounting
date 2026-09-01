"use client";

import Link from "next/link";
import { Maximize2, Minimize2, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";
import { QuickContactButton } from "@/components/quick-contact";

type Customer = { id: string; code: string; name: string; currencyCode: string };
type Option = { id: string; code: string; name: string };
type Document = { id: string; partyId: string; reference: string; date: string; currency: string; outstanding: string };
type Line = { id: number; description: string; accountId: string; quantity: string; unitPrice: string };
const emptyLine = (id: number): Line => ({ id, description: "", accountId: "", quantity: "1", unitPrice: "" });
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
  const [discounts, setDiscounts] = useState<Record<string, string>>({});
  const [allocationExpanded, setAllocationExpanded] = useState(false);
  const visibleDocuments = documents.filter((document) => document.partyId === customerId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const directTotal = lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0), 0);
  const allocationRows = useMemo(() => visibleDocuments.map((document) => { const outstanding = Number(document.outstanding), discount = liveDiscount(discounts[document.id] ?? "", outstanding), cash = Number(amounts[document.id]) || 0, settled = cash + discount.amount; return { document, outstanding, discount, cash, settled, remaining: Math.max(0, outstanding - settled), over: settled > outstanding + 0.00001 }; }), [visibleDocuments, amounts, discounts]);
  const allocationTotal = allocationRows.reduce((sum, row) => sum + row.cash, 0);
  const discountTotal = allocationRows.reduce((sum, row) => sum + row.discount.amount, 0);
  const settledTotal = allocationTotal + discountTotal;
  const updateLine = (id: number, field: keyof Omit<Line, "id">, value: string) => setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  const changeDiscount = (document: Document, input: string) => { const calculated = liveDiscount(input, Number(document.outstanding)); setDiscounts((current) => ({ ...current, [document.id]: input })); if (!calculated.error) setAmounts((current) => ({ ...current, [document.id]: Math.max(0, Number(document.outstanding) - calculated.amount).toFixed(2) })); };

  const changeMode = (next: "LINES" | "INVOICES") => {
    setMode(next);
    if (next === "INVOICES") {
      setPayerType("CUSTOMER");
      setCurrency(selectedCustomer?.currencyCode ?? defaultCurrency);
    }
  };

  useEffect(() => {
    if (!allocationExpanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setAllocationExpanded(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [allocationExpanded]);

  return <form action={action} className="form-panel">
    <input type="hidden" name="receiptMode" value={mode} />
    <section className="form-section"><div className="section-heading"><h2>Receipt details</h2><p>Record money received from a customer or another payer. The receipt date selects the accounting period automatically.</p></div>
      <div className="form-grid">
        <label>Receipt type <em>*</em><select value={mode} onChange={(event) => changeMode(event.target.value as "LINES" | "INVOICES")}><option value="LINES">Receipt with line items</option><option value="INVOICES">Settle customer invoice(s)</option></select></label>
        <AutoReferenceField example="RC-2026-0001" />
        <label>Date <em>*</em><input name="settlementDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label>
        <label>Received in <em>*</em><select name="bankAccountId" required><option value="">Select cash or bank account</option>{bankAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label>
        <label>Paid by <em>*</em><select name="payerType" value={payerType} onChange={(event) => { const next = event.target.value as "CUSTOMER" | "OTHER"; setPayerType(next); if (next === "OTHER") setCustomerId(""); }} disabled={mode === "INVOICES"}><option value="CUSTOMER">Customer</option>{mode === "LINES" && <option value="OTHER">Other</option>}</select>{mode === "INVOICES" && <input type="hidden" name="payerType" value="CUSTOMER" />}</label>
        {payerType === "CUSTOMER" ? <div className="quick-party-field"><label>Customer <em>*</em><select name="partyId" value={customerId} onChange={(event) => { const id = event.target.value; setCustomerId(id); setAmounts({}); setDiscounts({}); const customer = customers.find((entry) => entry.id === id); if (mode === "INVOICES" && customer) setCurrency(customer.currencyCode); }} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} — {customer.name}</option>)}</select></label><QuickContactButton kind="customer" onCreated={(customer) => { const created = { ...customer, currencyCode: defaultCurrency }; setCustomers((current) => [...current, created]); setCustomerId(created.id); }} /></div> : <label>Name of payer <em>*</em><input name="payerName" placeholder="Person or business name" required /></label>}
        {mode === "LINES" && <label>Currency <em>*</em><select name="currency" value={currency} onChange={(event) => setCurrency(event.target.value)}>{currencies.map((code) => <option key={code}>{code}</option>)}</select></label>}
        <label className={mode === "INVOICES" ? "span-2" : ""}>Description<input name="description" placeholder="Purpose of receipt or supporting reference" /></label>
      </div>
    </section>

    {mode === "LINES" ? <section className={`form-section commercial-line-section receipt-line-section${allocationExpanded ? " is-expanded" : ""}`}><div className="section-heading line-heading"><div><h2>Line items</h2><p>Allocate the receipt to revenue, other income, liability, equity, or another suitable non-control account.</p></div><div className="line-heading-actions"><button type="button" className="button-secondary" onClick={() => setAllocationExpanded((value) => !value)}>{allocationExpanded ? <><Minimize2 size={15}/>Close sub-window</> : <><Maximize2 size={15}/>Open in sub-window</>}</button><button type="button" className="button-secondary" onClick={() => setLines((current) => [...current, emptyLine(Math.max(...current.map((line) => line.id)) + 1)])}><Plus size={15} />Add line</button></div></div>
      <div className="data-table-wrap"><table className="data-table receipt-allocation-table"><thead><tr><th>Description</th><th>Ledger account</th><th>Qty</th><th>Unit price</th><th className="numeric">Amount</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.id}>
        <td><input name="lineDescription" value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} required /></td>
        <td><select name="lineAccountId" value={line.accountId} onChange={(event) => updateLine(line.id, "accountId", event.target.value)} required><option value="">Select ledger account</option>{postingAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></td>
        <td><input name="lineQuantity" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} required /></td>
        <td><input name="lineUnitPrice" type="number" min="0.01" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} required /></td>
        <td className="numeric">{currency} {((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0)).toFixed(2)}</td>
        <td><button type="button" className="line-delete" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((entry) => entry.id !== line.id))}><Trash2 size={16} /></button></td>
      </tr>)}</tbody></table></div><div className="document-total"><span>Lines <strong>{lines.length}</strong></span><span className="grand-total">Receipt total <strong>{currency} {directTotal.toFixed(2)}</strong></span></div>{allocationExpanded && <div className="subwindow-submit"><button type="button" className="button-secondary" onClick={() => setAllocationExpanded(false)}>Cancel</button><button className="button-primary">Post receipt</button></div>}
    </section> : <section className={`form-section commercial-line-section settlement-allocation-section receipt-invoice-section${allocationExpanded ? " is-expanded" : ""}`}><div className="section-heading line-heading"><div><h2>Invoice allocation</h2><p>Enter a sales discount as a fixed amount or percentage. Cash received remains editable for partial settlement.</p></div><div className="line-heading-actions"><button type="button" className="button-secondary" onClick={() => setAllocationExpanded((value) => !value)}>{allocationExpanded ? <><Minimize2 size={15}/>Close sub-window</> : <><Maximize2 size={15}/>Open in sub-window</>}</button></div></div><div className="data-table-wrap"><table className="data-table settlement-table"><thead><tr><th>Reference</th><th>Date</th><th className="numeric">Outstanding</th><th className="numeric">Sales discount</th><th className="numeric">Discount amount</th><th className="numeric">Cash received</th><th className="numeric">Total settled</th><th className="numeric">Remaining</th></tr></thead><tbody>
      {allocationRows.map(({ document, outstanding, discount, settled, remaining, over }) => <tr key={document.id}><td><strong>{document.reference}</strong><input type="hidden" name="documentId" value={document.id} /></td><td>{document.date}</td><td className="numeric">{document.currency} {outstanding.toFixed(2)}</td><td className="numeric"><input name="discountInput" value={discounts[document.id] ?? ""} onChange={(event) => changeDiscount(document, event.target.value)} placeholder="5% or 50.00" aria-invalid={Boolean(discount.error)} />{discount.error && <small className="field-error">{discount.error}</small>}</td><td className="numeric">{document.currency} {discount.amount.toFixed(2)}</td><td className="numeric"><input name="allocationAmount" type="number" min="0" step="0.01" value={amounts[document.id] ?? ""} onChange={(event) => setAmounts((current) => ({ ...current, [document.id]: event.target.value }))} placeholder="0.00" /></td><td className="numeric">{document.currency} {settled.toFixed(2)}</td><td className={`numeric${over ? " field-error" : ""}`}>{over ? "Exceeds outstanding" : `${document.currency} ${remaining.toFixed(2)}`}</td></tr>)}
      {!customerId && <tr><td colSpan={8}>Select a customer to view open invoices.</td></tr>}{customerId && !visibleDocuments.length && <tr><td colSpan={8}>No open invoices for this customer.</td></tr>}
    </tbody></table></div><div className="document-total settlement-totals"><span>Invoices selected <strong>{allocationRows.filter((row) => row.settled > 0).length}</strong></span><span>Sales discount <strong>{selectedCustomer?.currencyCode ?? defaultCurrency} {discountTotal.toFixed(2)}</strong></span><span>Cash received <strong>{selectedCustomer?.currencyCode ?? defaultCurrency} {allocationTotal.toFixed(2)}</strong></span><span className="grand-total">Total settled <strong>{selectedCustomer?.currencyCode ?? defaultCurrency} {settledTotal.toFixed(2)}</strong></span></div>{allocationExpanded && <div className="subwindow-submit"><button type="button" className="button-secondary" onClick={() => setAllocationExpanded(false)}>Cancel</button><button className="button-primary">Post receipt</button></div>}</section>}
    <div className="form-actions"><Link href="/receipts" className="button-secondary">Cancel</Link><button className="button-primary">Post receipt</button></div>
  </form>;
}
