"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useState } from "react";
import { createClientUser } from "@/app/settings/portal/actions";

export function ClientUserForm() {
  const [state, action, pending] = useActionState(createClientUser, {});
  const [showPassword, setShowPassword] = useState(false);
  return <form action={action} className="client-user-form">
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    {state.success && <div className="form-success" role="status">{state.success}</div>}
    <div className="form-grid">
      <label>Name<input name="displayName" required maxLength={120}/></label>
      <label>Email<input name="email" type="email" autoComplete="off" required/></label>
      <label>Initial password<div className="password-entry"><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} required/><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide initial password" : "Show initial password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div><small>Use at least 12 characters and share it securely.</small></label>
      <label>Portal role<select name="clientRole" defaultValue="CLIENT_FINANCE_VIEWER"><option value="CLIENT_ADMIN">Client administrator</option><option value="CLIENT_DIRECTOR">Client director</option><option value="CLIENT_FINANCE_VIEWER">Finance viewer</option><option value="CLIENT_PAYROLL_VIEWER">Payroll viewer</option><option value="CLIENT_DOCUMENT_CONTRIBUTOR">Document contributor</option></select></label>
    </div><div className="form-actions"><button className="button-primary" disabled={pending}>{pending ? "Creating…" : "Create client user"}</button></div>
  </form>;
}
