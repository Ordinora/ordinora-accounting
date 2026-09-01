import Link from "next/link";
import { notFound } from "next/navigation";
import { Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { requireActiveTenant } from "@/lib/session";
import { calculateSectionG } from "@/lib/tax-payable";
import { updateTaxComputation } from "../../../actions";

export const dynamic = "force-dynamic";

function money(currency: string, value: { toString(): string }) {
  const numeric = Number(value.toString());
  const shown = Math.abs(numeric).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${numeric < 0 ? `(${shown})` : shown}`;
}

export default async function TaxComputationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, { user, tenants, active }] = await Promise.all([params, searchParams, requireActiveTenant()]);
  const year = await db.taxYear.findFirst({ where: { id, tenantId: active.id } });
  if (!year) notFound();
  const calculation = calculateSectionG({
    companyCategory: year.taxCompanyCategory === "NEWLY_INCORPORATED" ? "NEWLY_INCORPORATED" : "OTHER",
    rateMode: year.taxRateMode === "POST_PIONEER" || year.taxRateMode === "LNG" ? year.taxRateMode : "STANDARD",
    taxRate: year.taxRate.toString(),
    chargeableIncome: year.chargeableIncome.toString(),
    foreignIncome: year.foreignIncome.toString(),
    doubleTaxRelief: year.doubleTaxRelief.toString(),
    tapCredit: year.tapTaxCredit.toString(),
    localEmploymentCredit: year.localEmploymentCredit.toString(),
    trainingCredit: year.trainingTaxCredit.toString(),
    exportSalesTax: year.exportSalesTax.toString(),
    taxPaidEci: year.taxPaidEci.toString(),
    priorYearTaxOffset: year.priorYearTaxOffset.toString(),
    withholdingTaxPaid: year.withholdingTaxPaid.toString(),
  });
  const isNew = calculation.companyCategory === "NEWLY_INCORPORATED";
  const grossCode = isNew ? "G4" : "G8";
  const bandRows = calculation.rateMode === "LNG" ? [] : [
    { code: isNew ? "G1" : "G5", label: "First BND 100,000", taxable: calculation.firstBand, factor: isNew ? "Exempt" : "25%", amount: calculation.firstTax },
    { code: isNew ? "G2" : "G6", label: "Next BND 150,000", taxable: calculation.nextBand, factor: "50%", amount: calculation.nextTax },
    { code: isNew ? "G3" : "G7", label: "Remaining balance", taxable: calculation.remainingBand, factor: "100%", amount: calculation.remainingTax },
  ];
  const shellUser = { displayName: user.displayName, email: user.email, role: user.staffRole?.replaceAll("_", " ") ?? "STAFF", firmName: user.firm.name };
  return <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle={`Tax Computation ${year.year}`} pageDescription="OCP Income Tax Form Section G working paper">
    <main className="module-page form-page">
      <div className="detail-toolbar"><Link href="/tax" className="back-link">← Tax workspace</Link><span className="status-badge">{year.status.replaceAll("_", " ")}</span></div>
      <header className="module-header"><div><p className="eyebrow">{active.legalName.toUpperCase()}</p><h2>Section G: Tax Payable</h2><p>Year of Assessment {year.year}. Draft computation only; review against the completed OCP return before filing.</p></div></header>
      {query.error && <div className="form-error tax-page-error" role="alert">{query.error}</div>}
      <form action={updateTaxComputation.bind(null, year.id)} className="surface-card form-panel">
        <section className="form-section"><div className="section-heading"><h2>Chargeable income and rate</h2><p>Enter the finalized F13 chargeable income after tax adjustments, capital allowances, and allowable losses. Accounting profit is not substituted automatically.</p></div><div className="form-grid">
          <label>Company category<select name="taxCompanyCategory" defaultValue={calculation.companyCategory}><option value="NEWLY_INCORPORATED">Newly incorporated - first 3 YOA</option><option value="OTHER">Other company</option></select></label>
          <label>Rate basis<select name="taxRateMode" defaultValue={calculation.rateMode}><option value="STANDARD">Standard corporate rate</option><option value="POST_PIONEER">Post-pioneer approved rate</option><option value="LNG">LNG / refined petroleum rate</option></select></label>
          <label>Tax rate (%)<input name="taxRate" type="number" min="0.0001" max="100" step="0.0001" defaultValue={calculation.taxRate.toString()}/><small>Standard is fixed at 18.5%; LNG is fixed at 55%. Enter the approved rate only for post-pioneer status.</small></label>
          <label>F13 Chargeable income<input name="chargeableIncome" type="number" min="0" step="0.01" defaultValue={calculation.chargeableIncome.toString()} required/></label>
        </div></section>
        <section className="form-section"><div className="section-heading"><h2>Relief, credits, export tax, and payments</h2><p>These are reviewed tax-return inputs. They do not post journals or file anything with OCP.</p></div><div className="form-grid">
          <label>G9 Foreign income<input name="foreignIncome" type="number" min="0" step="0.01" defaultValue={calculation.foreignIncome.toString()} required/></label>
          <label>G10 Double-taxation relief<input name="doubleTaxRelief" type="number" min="0" step="0.01" defaultValue={calculation.doubleTaxRelief.toString()} required/></label>
          <label>G12(i) TAP contribution credit<input name="tapTaxCredit" type="number" min="0" step="0.01" defaultValue={calculation.tapCredit.toString()} required/></label>
          <label>G12(ii) New local employment credit<input name="localEmploymentCredit" type="number" min="0" step="0.01" defaultValue={calculation.localEmploymentCredit.toString()} required/></label>
          <label>G12(iii) Training expenditure credit<input name="trainingTaxCredit" type="number" min="0" step="0.01" defaultValue={calculation.trainingCredit.toString()} required/></label>
          <label>G13 Tax payable on export sales<input name="exportSalesTax" type="number" min="0" step="0.01" defaultValue={calculation.exportSalesTax.toString()} required/><small>Enter the OCP-calculated amount after confirming qualifying export sales.</small></label>
          <label>G15(i) Tax paid based on ECI<input name="taxPaidEci" type="number" min="0" step="0.01" defaultValue={calculation.taxPaidEci.toString()} required/></label>
          <label>G15(ii) Prior-year tax offset<input name="priorYearTaxOffset" type="number" min="0" step="0.01" defaultValue={calculation.priorYearTaxOffset.toString()} required/></label>
          <label>G15(iii) Withholding tax paid<input name="withholdingTaxPaid" type="number" min="0" step="0.01" defaultValue={calculation.withholdingTaxPaid.toString()} required/></label>
        </div></section>
        <div className="form-actions"><Link href="/tax" className="button-secondary">Cancel</Link><button className="button-primary"><Save size={15}/>Save and calculate</button></div>
      </form>
      <section className="surface-card table-card tax-section"><div className="card-header"><div><h3>{isNew ? "Newly incorporated company" : "Other company"} tax bands</h3><p>{calculation.rateMode === "LNG" ? "Section 35A special rate applied directly to chargeable income." : `Threshold calculation at ${calculation.taxRate.toString()}%.`}</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Field</th><th>Calculation</th><th className="numeric">Income in band</th><th className="numeric">Tax payable</th></tr></thead><tbody>
        {bandRows.map(row=><tr key={row.code}><td><strong>{row.code}</strong></td><td>{row.label} × {row.factor} × {calculation.taxRate.toString()}%</td><td className="numeric">{money(active.defaultCurrency,row.taxable)}</td><td className="numeric">{money(active.defaultCurrency,row.amount)}</td></tr>)}
        <tr><td><strong>{grossCode}</strong></td><td>{calculation.rateMode === "LNG" ? `Chargeable income × ${calculation.taxRate.toString()}%` : isNew ? "Gross Tax Payable" : "Total Tax Payable"}</td><td className="numeric">{calculation.rateMode === "LNG" ? money(active.defaultCurrency, calculation.chargeableIncome) : "—"}</td><td className="numeric"><strong>{money(active.defaultCurrency,calculation.grossTaxPayable)}</strong></td></tr>
      </tbody></table></div></section>
      <section className="surface-card table-card tax-section"><div className="card-header"><div><h3>G9 to G16 reconciliation</h3><p>Amounts flow from gross tax through relief, credits, export tax, and taxes already paid.</p></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Field</th><th>Description</th><th className="numeric">Amount</th></tr></thead><tbody>
        <tr><td>G9</td><td>Foreign income</td><td className="numeric">{money(active.defaultCurrency,calculation.foreignIncome)}</td></tr>
        <tr><td>G10</td><td>Double-taxation relief</td><td className="numeric">{money(active.defaultCurrency,calculation.doubleTaxRelief)}</td></tr>
        <tr><td><strong>G11</strong></td><td>Tax Payable after Double Taxation Relief</td><td className="numeric"><strong>{money(active.defaultCurrency,calculation.taxAfterDoubleTaxRelief)}</strong></td></tr>
        <tr><td>G12</td><td>Total Tax Credits</td><td className="numeric">{money(active.defaultCurrency,calculation.totalTaxCredits)}</td></tr>
        <tr><td>G13</td><td>Tax payable on export sales</td><td className="numeric">{money(active.defaultCurrency,calculation.exportSalesTax)}</td></tr>
        <tr><td><strong>G14</strong></td><td>Net Tax Payable</td><td className="numeric"><strong>{money(active.defaultCurrency,calculation.netTaxPayable)}</strong></td></tr>
        <tr><td>G15</td><td>Tax Already Paid</td><td className="numeric">{money(active.defaultCurrency,calculation.totalTaxAlreadyPaid)}</td></tr>
        <tr><td><strong>G16</strong></td><td>{calculation.balanceTaxPayable.lt(0) ? "Balance Tax Refundable" : "Balance Tax Payable"}</td><td className="numeric"><strong>{money(active.defaultCurrency,calculation.balanceTaxPayable)}</strong></td></tr>
      </tbody></table></div></section>
      <p className="form-help tax-section">Source basis: OCP Income Tax Form Guide for YOA 2022 onwards, Section G. This working paper does not replace professional review or OCP filing validation.</p>
    </main>
  </AppShell>;
}
