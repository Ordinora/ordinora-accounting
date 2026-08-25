"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";

type Customer = { id: string; code: string; name: string; paymentTermsDays: number; currencyCode: string };
type Account = { id: string; code: string; name: string };
type Item = { id: string; sku: string; name: string; revenueAccountId: string };
type Location = { id: string; code: string; name: string };
type Line = { key: number; description: string; accountId: string; itemId: string; locationId: string; quantity: string; unitPrice: string; discountPercent: string };
const blank = (key: number): Line => ({ key, description: "", accountId: "", itemId: "", locationId: "", quantity: "1", unitPrice: "", discountPercent: "0" });

export function SalesQuotationForm({ action, customers, accounts, items, locations, documentType = "quotation" }: { action: (data: FormData) => Promise<void>; customers: Customer[]; accounts: Account[]; items: Item[]; locations: Location[]; documentType?: "quotation" | "order" }) {
  const currentDate = new Date();
  const today = currentDate.toISOString().slice(0, 10);
  const expiryDate = new Date(currentDate);
  expiryDate.setUTCDate(expiryDate.getUTCDate() + 30);
  const defaultExpiry = expiryDate.toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState(""); const [lines, setLines] = useState<Line[]>([blank(1)]);
  const currency = customers.find((customer) => customer.id === customerId)?.currencyCode || "BND";
  const amount = (line: Line) => (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * (1 - (Number(line.discountPercent) || 0) / 100);
  const total = useMemo(() => lines.reduce((sum, line) => sum + amount(line), 0), [lines]);
  const update = (key: number, field: keyof Omit<Line, "key">, value: string) => setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  const isOrder = documentType === "order";
  return <form action={action} className="form-panel">
    <section className="form-section"><div className="section-heading"><h2>{isOrder ? "Sales order details" : "Quotation details"}</h2><p>Saving this {isOrder ? "order" : "quotation"} does not post revenue, receivables, COGS, or inventory movements.</p></div><div className="form-grid">
      <label>Customer<select name="customerId" required value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} — {customer.name} ({customer.currencyCode})</option>)}</select></label>
      <AutoReferenceField example={isOrder ? "SO-2026-0001" : "SQ-2026-0001"} />
      <label>{isOrder ? "Order date" : "Quotation date"}<input name="quoteDate" type="date" defaultValue={today} required /></label>
      <label>{isOrder ? "Expected fulfillment" : "Valid until"}<input name="validUntil" type="date" defaultValue={defaultExpiry} required /></label>
      <label className="span-2">Description<input name="description" required /></label>
    </div></section>
    <section className="form-section"><div className="section-heading line-heading"><div><h2>{isOrder ? "Order lines" : "Quotation lines"}</h2><p>Inventory lines remember the intended stock location but do not reserve or move stock.</p></div><button type="button" className="button-secondary" onClick={() => setLines((current) => [...current, blank(Math.max(...current.map((line) => line.key)) + 1)])}><Plus size={15} />Add line</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Description</th><th>Inventory item</th><th>Location</th><th>Revenue account</th><th>Qty</th><th>Unit price</th><th>Discount %</th><th>Net amount</th><th /></tr></thead><tbody>{lines.map((line) => <tr key={line.key}>
        <td><input name="lineDescription" value={line.description} onChange={(event) => update(line.key, "description", event.target.value)} required /></td>
        <td><select name="lineItemId" value={line.itemId} onChange={(event) => { const item = items.find((entry) => entry.id === event.target.value); setLines((current) => current.map((entry) => entry.key === line.key ? { ...entry, itemId: event.target.value, accountId: item?.revenueAccountId || entry.accountId, description: item?.name || entry.description } : entry)); }}><option value="">Non-inventory</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</select></td>
        <td><select name="lineLocationId" disabled={!line.itemId} required={!!line.itemId} value={line.locationId} onChange={(event) => update(line.key, "locationId", event.target.value)}><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select>{!line.itemId && <input type="hidden" name="lineLocationId" value="" />}</td>
        <td><select name="lineAccountId" disabled={!!line.itemId} required={!line.itemId} value={line.accountId} onChange={(event) => update(line.key, "accountId", event.target.value)}><option value="">{line.itemId ? "Mapped from item" : "Select account"}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select>{line.itemId && <input type="hidden" name="lineAccountId" value={line.accountId} />}</td>
        <td><input name="lineQuantity" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => update(line.key, "quantity", event.target.value)} required /></td>
        <td><input name="lineUnitPrice" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => update(line.key, "unitPrice", event.target.value)} required /></td>
        <td><input name="lineDiscountPercent" type="number" min="0" max="100" step="0.01" value={line.discountPercent} onChange={(event) => update(line.key, "discountPercent", event.target.value)} required /></td>
        <td>{currency} {amount(line).toFixed(2)}</td><td><button type="button" className="line-delete" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}><Trash2 size={16} /></button></td>
      </tr>)}</tbody></table></div><div className="document-total"><span>Lines <strong>{lines.length}</strong></span><span className="grand-total">Quotation total <strong>{currency} {total.toFixed(2)}</strong></span></div>
    </section><div className="form-actions"><Link href={isOrder ? "/sales/orders" : "/sales/quotations"} className="button-secondary">Cancel</Link><button className="button-primary">Save draft {isOrder ? "order" : "quotation"}</button></div>
  </form>;
}
