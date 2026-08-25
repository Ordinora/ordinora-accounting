"use client";

import Link from "next/link";
import { Download, Upload } from "lucide-react";
import { ChangeEvent, useActionState, useState } from "react";
import { AutoReferenceField } from "@/components/auto-reference-field";

export type RetailImportState = { error?: string };
type Option = { id: string; label: string };

function csvFields(row: string) {
  const values: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' && quoted && row[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value.trim()); value = ""; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

function suggested(headers: string[], aliases: string[]) {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return headers.find(header => aliases.includes(normalized(header))) ?? "";
}

export function RetailSalesImportForm({ action, accounts }: {
  action: (state: RetailImportState, data: FormData) => Promise<RetailImportState>;
  accounts: Option[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [headers, setHeaders] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});

  async function inspectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) { setHeaders([]); setDefaults({}); return; }
    const firstLine = (await file.slice(0, 32_000).text()).replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
    const found = csvFields(firstLine).filter(Boolean);
    setHeaders(found);
    setDefaults({
      sku: suggested(found, ["sku", "itemcode", "productcode", "barcode"]),
      location: suggested(found, ["location", "warehouse", "outlet", "branch", "stocklocation"]),
      quantity: suggested(found, ["quantity", "qty", "qtysold", "unitssold", "units"]),
      unitPrice: suggested(found, ["unitprice", "sellingprice", "price", "averageprice"]),
      totalAmount: suggested(found, ["totalamount", "amount", "netsales", "salesamount", "grosssales", "linetotal"]),
      description: suggested(found, ["description", "itemname", "product", "productname", "item"]),
    });
  }

  const mapping = (name: string, label: string, defaultKey: string, optional = false) => <label>{label}
    <select name={name} key={`${name}-${defaults[defaultKey] ?? ""}`} defaultValue={defaults[defaultKey] ?? ""} required={!optional}>
      <option value="">{optional ? "Not provided" : "Select CSV column"}</option>
      {headers.map(header => <option value={header} key={header}>{header}</option>)}
    </select>
  </label>;

  return <form action={formAction} className="form-panel">
    <section className="form-section">
      <div className="section-heading"><h2>Retail sales summary</h2><p>Upload one summarized cash/card/bank register. Each CSV row represents one inventory item sold, and the register date selects the accounting period automatically.</p></div>
      {state.error && <div className="form-error" role="alert">{state.error}</div>}
      <div className="form-grid">
        <AutoReferenceField label="Register reference" example="DS-2026-0001" />
        <label>Register date<input name="registerDate" type="date" required /></label>
        <label>Register cash account<select name="cashAccountId" required defaultValue=""><option value="">Select cash account</option>{accounts.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
        <label>Branch<input name="branchLabel" placeholder="Main branch" /></label>
        <label>Register / source<input name="registerLabel" placeholder="POS monthly summary" /></label>
        <label>Opening cash float<input name="openingFloat" type="number" step="0.01" min="0" defaultValue="0.00" required /></label>
        <label>Actual closing cash<input name="actualClosingCash" type="number" step="0.01" min="0" required /></label>
      </div>
    </section>
    <section className="form-section">
      <div className="section-heading"><h2>Sales item CSV</h2><p>Upload your POS export, then map its column names to Ordinora fields.</p></div>
      <div className="form-actions"><a href="/templates/retail-sales-import.csv" download className="button-secondary"><Download size={15} />Download Ordinora template</a></div>
      <label>CSV file<input name="salesFile" type="file" accept=".csv,text/csv" onChange={inspectFile} required /></label>
      {headers.length > 0 && <div className="form-grid">
        {mapping("skuColumn", "SKU / item code / barcode", "sku")}
        {mapping("locationColumn", "Stock location", "location")}
        {mapping("quantityColumn", "Quantity sold", "quantity")}
        {mapping("unitPriceColumn", "Unit price", "unitPrice", true)}
        {mapping("totalAmountColumn", "Total sales amount", "totalAmount", true)}
        {mapping("descriptionColumn", "Description / item name", "description", true)}
      </div>}
      {headers.length > 0 && <div className="form-notice"><strong>Pricing</strong><span>Map either Unit price or Total sales amount. If both are mapped, Ordinora uses Unit price.</span></div>}
    </section>
    <section className="form-section">
      <div className="section-heading"><h2>Tender totals</h2><p>The combined tender total must equal the CSV sales value.</p></div>
      <div className="form-grid">
        <label>Cash amount<input name="cashAmount" type="number" min="0" step="0.01" defaultValue="0.00" /></label>
        <label>Card amount<input name="cardAmount" type="number" min="0" step="0.01" defaultValue="0.00" /></label>
        <label>Card deposit account<select name="cardAccountId" defaultValue=""><option value="">Select when card amount is used</option>{accounts.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
        <label>Bank / QR amount<input name="bankAmount" type="number" min="0" step="0.01" defaultValue="0.00" /></label>
        <label>Bank / QR account<select name="bankAccountId" defaultValue=""><option value="">Select when bank amount is used</option>{accounts.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
        <label>Other tender amount<input name="otherAmount" type="number" min="0" step="0.01" defaultValue="0.00" /></label>
        <label>Other deposit account<select name="otherAccountId" defaultValue=""><option value="">Select when other amount is used</option>{accounts.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
      </div>
    </section>
    <div className="form-actions"><Link href="/cash-sales" className="button-secondary">Cancel</Link><button className="button-primary" disabled={pending || headers.length === 0}><Upload size={15} />{pending ? "Validating and posting…" : "Import and post"}</button></div>
  </form>;
}
