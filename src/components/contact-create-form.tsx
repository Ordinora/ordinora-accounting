"use client";

import { useActionState } from "react";
import type { ContactCreateState } from "@/app/contacts/actions";

export function ContactCreateForm({ kind, action }: { kind: "customer" | "supplier"; action: (state: ContactCreateState, formData: FormData) => Promise<ContactCreateState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="surface-card compact-form"><div className="card-header"><div><h3>Add {kind}</h3><p>Create a tenant-owned contact.</p></div></div><div className="compact-form-body">
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    <label>Code<input name="code" required maxLength={20} placeholder={kind === "customer" ? "CUS-001" : "SUP-001"} /></label><label>Name<input name="name" required maxLength={120} /></label><label>Email<input name="email" type="email" /></label><label>Phone<input name="phone" maxLength={40} /></label><label>Payment terms<input name="paymentTermsDays" type="number" min="0" max="365" defaultValue="30" /></label><label>Address<textarea name="address" maxLength={300} rows={3} /></label><button className="button-primary" disabled={pending}>{pending ? "Creating…" : `Create ${kind}`}</button>
  </div></form>;
}
