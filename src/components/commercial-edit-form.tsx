"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Maximize2, Minimize2, Plus, Save, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import type { CommercialActionState } from "@/app/commercial/actions";
import { QuickInventoryItemButton, type InventoryMappingAccount } from "@/components/quick-inventory-item";

type Account = { id: string; code: string; name: string; type: string };
type Item = { id: string; sku: string; name: string; revenueAccountId: string; inventoryAccountId: string };
type Location = { id: string; code: string; name: string };
type Line = { id: number; description: string; accountId: string; itemId: string; locationId: string; quantity: string; unitPrice: string; discountPercent: string };
type InitialDocument = { id: string; partyLabel: string; reference: string; documentDate: string; dueDate: string; description: string; currency: string; discountType: "NONE" | "PERCENT" | "AMOUNT"; discountValue: string; lines: Omit<Line, "id">[] };

const emptyLine = (id: number): Line => ({ id, description: "", accountId: "", itemId: "", locationId: "", quantity: "1", unitPrice: "", discountPercent: "0" });

export function CommercialEditForm({ kind, action: submitAction, document: initialDocument, accounts, items: initialItems, locations, mappingAccounts, linked, deleteHref, sourceLocked }: { kind: "sale" | "purchase"; action: (state: CommercialActionState, data: FormData) => Promise<CommercialActionState>; document: InitialDocument; accounts: Account[]; items: Item[]; locations: Location[]; mappingAccounts: InventoryMappingAccount[]; linked: number; deleteHref?: string; sourceLocked?: boolean }) {
  const router = useRouter();
  const isSale = kind === "sale";
  const [state, formAction, pending] = useActionState(submitAction, {});
  const [lines, setLines] = useState<Line[]>(initialDocument.lines.map((line, index) => ({ ...line, id: index + 1 })));
  const [items, setItems] = useState(initialItems);
  const [quickLineId, setQuickLineId] = useState(1);
  const [discountType, setDiscountType] = useState(initialDocument.discountType);
  const [discountValue, setDiscountValue] = useState(initialDocument.discountValue);
  const [expanded, setExpanded] = useState(false);
  const disabled = linked > 0 || sourceLocked;

  useEffect(() => { if (state.redirectTo) { router.replace(state.redirectTo); router.refresh(); } }, [router, state.redirectTo]);
  useEffect(() => { if (!expanded) return; const previous = documentBodyOverflow(); const close = (event: KeyboardEvent) => { if (event.key === "Escape") setExpanded(false); }; window.addEventListener("keydown", close); return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); }; }, [expanded]);

  const update = (id: number, field: keyof Omit<Line, "id">, value: string) => setLines((current) => current.map((line) => line.id === id ? { ...line, [field]: value } : line));
  const amount = (line: Line) => (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * (1 - (Number(line.discountPercent) || 0) / 100);
  const subtotal = lines.reduce((sum, line) => sum + amount(line), 0);
  const discountInput = Math.max(Number(discountValue) || 0, 0);
  const documentDiscount = discountType === "PERCENT" ? subtotal * discountInput / 100 : discountType === "AMOUNT" ? discountInput : 0;
  const total = Math.max(subtotal - documentDiscount, 0);

  return <form action={formAction} className="form-panel">
    <input type="hidden" name="id" value={initialDocument.id}/>
    <section className="form-section"><div className="section-heading"><h2>Document details</h2><p>Saving updates the source document, journal, totals, and permitted inventory effects together.</p></div><div className="form-grid">
      <label>{isSale ? "Customer" : "Supplier"}<input value={initialDocument.partyLabel} readOnly/></label>
      <label>Reference<input name="reference" required maxLength={40} defaultValue={initialDocument.reference} disabled={disabled}/></label>
      <label>Document date<input type="date" value={initialDocument.documentDate} readOnly/></label>
      <label>Due date<input name="dueDate" type="date" required defaultValue={initialDocument.dueDate} disabled={disabled}/></label>
      <label className="span-2">Description<input name="description" required defaultValue={initialDocument.description} disabled={disabled}/></label>
      <label className="span-2">Reason for update<input name="reason" required minLength={5} maxLength={240} placeholder="Explain what changed" disabled={disabled}/></label>
    </div></section>
    <section className={`form-section commercial-line-section${expanded ? " is-expanded" : ""}`}><div className="section-heading line-heading"><h2>Line items</h2><div className="line-heading-actions">
      <button type="button" className="button-secondary" onClick={() => setExpanded((value) => !value)}>{expanded ? <><Minimize2 size={15}/>Close sub-window</> : <><Maximize2 size={15}/>Open in sub-window</>}</button>
      <QuickInventoryItemButton accounts={mappingAccounts} onCreated={(item) => { setItems((current) => [...current, item]); setLines((current) => current.map((line) => line.id === quickLineId ? { ...line, itemId: item.id, accountId: isSale ? item.revenueAccountId : item.inventoryAccountId, description: line.description || item.name } : line)); }}/>
      <button type="button" className="button-secondary" disabled={disabled} onClick={() => setLines((current) => { const id = Math.max(0, ...current.map((line) => line.id)) + 1; setQuickLineId(id); return [...current, emptyLine(id)]; })}><Plus size={15}/>Add line</button>
    </div></div>
    <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Description</th><th>Inventory item (optional)</th><th>Location</th><th>Ledger account</th><th>Qty</th><th>Unit price</th><th>Line discount %</th><th>Net amount</th><th/></tr></thead><tbody>{lines.map((line) => <tr key={line.id} onFocus={() => setQuickLineId(line.id)}>
      <td><input name="lineDescription" value={line.description} onChange={(event) => update(line.id, "description", event.target.value)} required disabled={disabled}/></td>
      <td><select name="lineItemId" value={line.itemId} disabled={disabled} onChange={(event) => { const item = items.find((candidate) => candidate.id === event.target.value); setLines((current) => current.map((candidate) => candidate.id === line.id ? { ...candidate, itemId: event.target.value, accountId: item ? (isSale ? item.revenueAccountId : item.inventoryAccountId) : candidate.accountId, description: item?.name || candidate.description } : candidate)); }}><option value="">Non-inventory line</option>{items.map((item) => <option key={item.id} value={item.id}>{item.sku} — {item.name}</option>)}</select></td>
      <td><select name="lineLocationId" value={line.locationId} onChange={(event) => update(line.id, "locationId", event.target.value)} disabled={disabled || !line.itemId} required={!!line.itemId}><option value="">Select location</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.code} — {location.name}</option>)}</select>{(!line.itemId || disabled) && <input type="hidden" name="lineLocationId" value={line.locationId}/>}</td>
      <td><select name="lineAccountId" value={line.accountId} onChange={(event) => update(line.id, "accountId", event.target.value)} disabled={disabled || !!line.itemId} required={!line.itemId}><option value="">{line.itemId ? "Mapped from item" : "Select account"}</option>{isSale ? accounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>) : <><optgroup label="Expense accounts">{accounts.filter((account) => account.type === "EXPENSE").map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</optgroup><optgroup label="Asset accounts">{accounts.filter((account) => account.type === "ASSET").map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</optgroup></>}</select>{(line.itemId || disabled) && <input type="hidden" name="lineAccountId" value={line.accountId}/>}</td>
      <td><input name="lineQuantity" type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(event) => update(line.id, "quantity", event.target.value)} required disabled={disabled}/></td>
      <td><input name="lineUnitPrice" type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => update(line.id, "unitPrice", event.target.value)} required disabled={disabled}/></td>
      <td><input name="lineDiscountPercent" type="number" min="0" max="100" step="0.01" value={line.discountPercent} onChange={(event) => update(line.id, "discountPercent", event.target.value)} required disabled={disabled}/></td>
      <td>{initialDocument.currency} {amount(line).toFixed(2)}</td><td><button type="button" className="line-delete" disabled={disabled || lines.length === 1} onClick={() => setLines((current) => current.filter((candidate) => candidate.id !== line.id))}><Trash2 size={16}/></button></td>
    </tr>)}</tbody></table></div>
    <div className="document-discount"><label>Document discount type<select name="discountType" value={discountType} disabled={disabled} onChange={(event) => { setDiscountType(event.target.value as typeof discountType); setDiscountValue("0"); }}><option value="NONE">No document discount</option><option value="AMOUNT">Fixed amount</option><option value="PERCENT">Percentage</option></select></label><label>{discountType === "PERCENT" ? "Discount percentage" : `Discount amount (${initialDocument.currency})`}<input name="discountValue" type="number" min="0" max={discountType === "PERCENT" ? 100 : undefined} step="0.01" value={discountValue} disabled={disabled || discountType === "NONE"} onChange={(event) => setDiscountValue(event.target.value)} required={discountType !== "NONE"}/></label></div>
    <div className="document-total document-total-breakdown"><span>Lines <strong>{lines.length}</strong></span><span>Subtotal <strong>{initialDocument.currency} {subtotal.toFixed(2)}</strong></span><span>Discount <strong>− {initialDocument.currency} {documentDiscount.toFixed(2)}</strong></span><span className="grand-total">Net amount <strong>{initialDocument.currency} {total.toFixed(2)}</strong></span></div>
    {expanded && <div className="subwindow-submit"><button type="button" className="button-secondary" onClick={() => setExpanded(false)}>Cancel</button><button className="button-primary" disabled={disabled || pending}><Save size={15}/>{pending ? "Saving…" : "Save update"}</button></div>}
    </section>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    <div className="form-actions"><Link href={isSale ? "/sales" : "/purchases"} className="button-secondary">Cancel</Link><button className="button-primary" disabled={disabled || pending}><Save size={16}/>{pending ? "Saving…" : "Save update"}</button>{deleteHref && <Link href={deleteHref} className="button-danger"><Trash2 size={15}/>Delete transaction</Link>}</div>
    {linked > 0 && <p className="form-error">This document has {linked} linked settlement or credit-note record{linked === 1 ? "" : "s"}. Remove those links before updating it.</p>}
    {sourceLocked && <p className="form-error">This document was converted from an order or quotation. Its lines must stay matched to that source document.</p>}
  </form>;
}

function documentBodyOverflow() { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return previous; }
