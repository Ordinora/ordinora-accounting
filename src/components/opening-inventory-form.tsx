"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";

type Option = { id: string; label: string };
type Line = { key: number; itemId: string; locationId: string; quantity: string; unitCost: string };

export function OpeningInventoryForm({ action, items, locations, offsetAccounts, currency }: {
  action: (data: FormData) => Promise<void>;
  items: Option[];
  locations: Option[];
  offsetAccounts: Option[];
  currency: string;
}) {
  const [postingMode, setPostingMode] = useState<"ALLOCATE_EXISTING" | "CREATE_JOURNAL">("ALLOCATE_EXISTING");
  const [lines, setLines] = useState<Line[]>([{ key: 1, itemId: "", locationId: "", quantity: "", unitCost: "" }]);
  const total = useMemo(() => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.unitCost) || 0), 0), [lines]);
  const update = (key: number, field: keyof Omit<Line, "key">, value: string) => setLines(rows => rows.map(row => row.key === key ? { ...row, [field]: value } : row));

  return <form action={action} className="form-panel">
    <section className="form-section">
      <div className="section-heading"><h2>Opening inventory batch</h2><p>Enter each item and location once. Item quantities and weighted-average opening costs will be created.</p></div>
      <div className="form-grid">
        <AutoReferenceField label="Reference" example="OINV-2026-0001" />
        <label>Opening date<input name="openingDate" type="date" required defaultValue="2026-03-01" /></label>
        <label>Accounting treatment<select name="postingMode" value={postingMode} onChange={event => setPostingMode(event.target.value as typeof postingMode)}><option value="ALLOCATE_EXISTING">Allocate existing opening inventory balance</option><option value="CREATE_JOURNAL">Create a new opening inventory journal</option></select></label>
        {postingMode === "CREATE_JOURNAL" && <label>Opening balance offset<select name="offsetAccountId" required defaultValue=""><option value="">Select equity or liability account</option>{offsetAccounts.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>}
        <label className={postingMode === "ALLOCATE_EXISTING" ? "span-2" : undefined}>Description<input name="description" required defaultValue="Opening inventory at conversion date" /></label>
      </div>
      <div className="form-notice">
        <strong>{postingMode === "ALLOCATE_EXISTING" ? "No additional general-ledger posting" : "A new general-ledger journal will be posted"}</strong>
        <span>{postingMode === "ALLOCATE_EXISTING" ? "Use this when the inventory asset is already included in the general opening-balance journal. The item allocation cannot exceed the remaining posted inventory balance." : "Use this only when inventory was excluded from the general opening-balance journal."}</span>
      </div>
    </section>
    <section className="form-section">
      <div className="section-heading line-heading"><div><h2>Inventory lines</h2><p>Value equals opening quantity multiplied by unit cost.</p></div><button type="button" className="button-secondary" onClick={() => setLines(rows => [...rows, { key: Math.max(...rows.map(x => x.key)) + 1, itemId: "", locationId: "", quantity: "", unitCost: "" }])}><Plus size={15} />Add line</button></div>
      <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Location</th><th>Quantity</th><th>Unit cost</th><th className="numeric">Value</th><th /></tr></thead><tbody>{lines.map(line => <tr key={line.key}><td><select name="itemId" required value={line.itemId} onChange={e => update(line.key, "itemId", e.target.value)}><option value="">Select item</option>{items.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></td><td><select name="locationId" required value={line.locationId} onChange={e => update(line.key, "locationId", e.target.value)}><option value="">Select location</option>{locations.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></td><td><input name="quantity" type="number" min="0.0001" step="0.0001" required value={line.quantity} onChange={e => update(line.key, "quantity", e.target.value)} /></td><td><input name="unitCost" type="number" min="0" step="0.0001" required value={line.unitCost} onChange={e => update(line.key, "unitCost", e.target.value)} /></td><td className="numeric">{currency} {((Number(line.quantity) || 0) * (Number(line.unitCost) || 0)).toFixed(2)}</td><td><button type="button" className="line-delete" disabled={lines.length === 1} onClick={() => setLines(rows => rows.filter(x => x.key !== line.key))}><Trash2 size={16} /></button></td></tr>)}</tbody></table></div>
      <div className="document-total"><span>Lines <strong>{lines.length}</strong></span><span className="grand-total">Opening inventory <strong>{currency} {total.toFixed(2)}</strong></span></div>
    </section>
    <div className="form-actions"><Link href="/inventory" className="button-secondary">Cancel</Link><button className="button-primary" disabled={!items.length || !locations.length || total <= 0}>{postingMode === "ALLOCATE_EXISTING" ? "Allocate opening inventory" : "Post opening inventory"}</button></div>
  </form>;
}
