import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { addCurrency, enableMulticurrency, saveExchangeRate } from "./actions";

export const dynamic = "force-dynamic";
export default async function CurrencySettingsPage() {
  const { user, tenants, active } = await requireActiveTenant();
  const [currencies, rates] = await Promise.all([
    db.tenantCurrency.findMany({ where: { tenantId: active.id }, orderBy: { code: "asc" } }),
    db.exchangeRate.findMany({ where: { tenantId: active.id }, orderBy: [{ effectiveOn: "desc" }, { currencyCode: "asc" }], take: 100 }),
  ]);
  const foreign = currencies.filter(c => c.code !== active.defaultCurrency && c.isActive);
  return <AppShell user={{ displayName:user.displayName,email:user.email,role:user.staffRole?.replaceAll("_"," ")??"STAFF",firmName:user.firm.name }} tenants={tenants} activeTenant={active} pageTitle="Currency Settings" pageDescription="Base currency and effective-dated exchange rates">
    <main className="module-page"><header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Multicurrency</h2><p>Foreign amounts are converted into {active.defaultCurrency} for the general ledger and financial reports.</p></div></header>
      {!active.multiCurrencyEnabled && <form action={enableMulticurrency} className="surface-card form-panel"><section className="form-section"><div className="section-heading"><h2>Enable multicurrency</h2><p>The base currency becomes locked after posted transactions exist.</p></div><div className="form-grid"><label>Base currency<input name="baseCurrency" defaultValue={active.defaultCurrency} maxLength={3} required /></label></div></section><div className="form-actions"><button className="button-primary">Enable multicurrency</button></div></form>}
      {active.multiCurrencyEnabled && <><section className="surface-card form-panel"><form action={addCurrency}><div className="section-heading"><h2>Add foreign currency</h2><p>Use a three-letter ISO code and the currency’s actual decimal precision.</p></div><div className="form-grid"><label>Code<input name="code" maxLength={3} placeholder="USD" required /></label><label>Name<input name="name" placeholder="US Dollar" required /></label><label>Symbol<input name="symbol" placeholder="$" required /></label><label>Decimal places<input name="decimalPlaces" type="number" min="0" max="4" defaultValue="2" required /></label></div><div className="form-actions"><button className="button-primary">Save currency</button></div></form></section>
      <section className="surface-card form-panel"><form action={saveExchangeRate}><div className="section-heading"><h2>Record exchange rate</h2><p>Enter how many {active.defaultCurrency} equal one unit of the foreign currency.</p></div><div className="form-grid"><label>Foreign currency<select name="currencyCode" required><option value="">Select currency</option>{foreign.map(c=><option key={c.id}>{c.code} — {c.name}</option>)}</select></label><label>Effective date<input name="effectiveOn" type="date" required /></label><label>Rate to {active.defaultCurrency}<input name="rateToBase" inputMode="decimal" placeholder="1.342500" required /></label></div><div className="form-actions"><button className="button-primary" disabled={!foreign.length}>Save exchange rate</button></div></form></section></>}
      <section className="surface-card table-card"><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Currency</th><th>Rate to {active.defaultCurrency}</th><th>Source</th></tr></thead><tbody>{rates.map(r=><tr key={r.id}><td>{r.effectiveOn.toISOString().slice(0,10)}</td><td><strong>{r.currencyCode}</strong></td><td>{r.rateToBase.toString()}</td><td>{r.source}</td></tr>)}{!rates.length&&<tr><td colSpan={4}>No foreign exchange rates recorded.</td></tr>}</tbody></table></div></section>
    </main></AppShell>;
}
