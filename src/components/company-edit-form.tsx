"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { updateCompany, type UpdateCompanyState } from "@/app/settings/companies/actions";

type Company = {
  id: string; legalName: string; tradingName: string | null; registrationNumber: string | null;
  entityType: "PRIVATE_LIMITED" | "SOLE_PROPRIETORSHIP" | "PARTNERSHIP" | "OTHER";
  registeredAddress: string | null; primaryContact: string | null; defaultCurrency: string;
  financialYearEndMonth: number; financialYearEndDay: number; multiCurrencyEnabled: boolean;
  status: "ACTIVE" | "DORMANT"; journalCount: number;
};

export function CompanyEditForm({ company }: { company: Company }) {
  const [state, action, pending] = useActionState<UpdateCompanyState, FormData>(updateCompany, {});
  return <form action={action} className="surface-card compact-form-body">
    <input type="hidden" name="companyId" value={company.id}/>
    <div className="card-header"><div><h3>Company details</h3><p>Changes apply across the company file and are recorded in the audit trail.</p></div></div>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    <div className="form-grid">
      <label>Legal company name<input name="legalName" required maxLength={160} defaultValue={company.legalName}/></label>
      <label>Trading name<input name="tradingName" maxLength={160} defaultValue={company.tradingName ?? ""}/></label>
      <label>Registration number<input name="registrationNumber" maxLength={80} defaultValue={company.registrationNumber ?? ""}/></label>
      <label>Entity type<select name="entityType" defaultValue={company.entityType}><option value="PRIVATE_LIMITED">Private limited company</option><option value="SOLE_PROPRIETORSHIP">Sole proprietorship</option><option value="PARTNERSHIP">Partnership</option><option value="OTHER">Other</option></select></label>
      <label>Primary contact<input name="primaryContact" maxLength={160} defaultValue={company.primaryContact ?? ""}/></label>
      <label>Base currency<input name="defaultCurrency" minLength={3} maxLength={3} required defaultValue={company.defaultCurrency}/><small>{company.journalCount ? "Locked after posted accounting entries." : "Use a three-letter currency code."}</small></label>
      <label>Financial year-end month<input name="financialYearEndMonth" type="number" min={1} max={12} required defaultValue={company.financialYearEndMonth}/></label>
      <label>Financial year-end day<input name="financialYearEndDay" type="number" min={1} max={31} required defaultValue={company.financialYearEndDay}/></label>
      <label>Status<select name="status" defaultValue={company.status}><option value="ACTIVE">Active</option><option value="DORMANT">Dormant</option></select><small>Dormant companies remain available for historical reporting.</small></label>
      <label className="checkbox-label"><input name="multiCurrencyEnabled" type="checkbox" defaultChecked={company.multiCurrencyEnabled}/>Enable multicurrency</label>
      <label className="full-span">Registered address<textarea name="registeredAddress" maxLength={500} rows={3} defaultValue={company.registeredAddress ?? ""}/></label>
      <label className="full-span">Reason for update<input name="reason" required minLength={5} maxLength={240} placeholder="Explain why these company details are changing"/></label>
    </div>
    <div className="form-actions"><Link href="/settings/companies" className="button-secondary">Cancel</Link><button className="button-primary" disabled={pending}><Save size={15}/>{pending ? "Saving company…" : "Save company"}</button></div>
  </form>;
}
