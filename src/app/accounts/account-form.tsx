"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { AccountType } from "@prisma/client";
import { classificationsForAccountType } from "@/lib/account-classifications";
import type { AccountActionState } from "./actions";

export function AccountForm({ action, account }: { action: (state: AccountActionState, formData: FormData) => Promise<AccountActionState>; account?: { id: string; code: string; name: string; type: AccountType; reportingClassification: string; isActive: boolean } }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [type, setType] = useState<AccountType>(account?.type ?? AccountType.EXPENSE);
  const options = classificationsForAccountType(type);
  return <form action={formAction} className="form-panel"><section className="form-section"><div className="section-heading"><h2>{account ? "Account details" : "Create account"}</h2><p>Account codes and account names must be unique within the selected company.</p></div>{state.error && <div className="form-error" role="alert">{state.error}</div>}{account && <input type="hidden" name="accountId" value={account.id} />}<div className="form-grid"><label>Account code <em>*</em><input name="code" required pattern="\d{3,8}" defaultValue={account?.code} placeholder="7100" /></label><label>Account type <em>*</em><select name="type" required value={type} onChange={event => setType(event.target.value as AccountType)}>{Object.values(AccountType).map(value => <option value={value} key={value}>{value}</option>)}</select></label><label className="span-2">Account name <em>*</em><input name="name" required defaultValue={account?.name} placeholder="Account name" /></label><label className="span-2">Reporting classification <em>*</em><select name="reportingClassification" required defaultValue={options.includes(account?.reportingClassification as never) ? account?.reportingClassification : options[0]} key={type}>{options.map(value => <option value={value} key={value}>{value}</option>)}</select></label>{account && <label className="checkbox-label"><input type="checkbox" name="isActive" defaultChecked={account.isActive} /><span><strong>Active account</strong><small>Inactive accounts remain in historical postings but cannot be selected for new journals.</small></span></label>}</div></section><div className="form-actions"><Link href="/accounts" className="button-secondary">Cancel</Link><button className="button-primary" disabled={pending}>{pending ? "Saving…" : account ? "Save changes" : "Create account"}</button></div></form>;
}
