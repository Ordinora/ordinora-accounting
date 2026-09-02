"use client";

import { Eye, EyeOff, KeyRound, X } from "lucide-react";
import { useActionState, useState } from "react";
import { resetClientUserPassword } from "@/app/settings/portal/actions";

export function ClientPasswordReset({ userId, displayName }: { userId: string; displayName: string }) {
  const [editing, setEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(resetClientUserPassword.bind(null, userId), {});

  if (!editing) {
    return <button type="button" className="button-secondary" onClick={() => setEditing(true)}><KeyRound size={15}/>Reset password</button>;
  }

  return <form action={action} className="client-password-reset">
    <div className="client-password-heading"><strong>Set a new password for {displayName}</strong><button type="button" onClick={() => setEditing(false)} aria-label="Cancel password reset"><X size={16}/></button></div>
    {state.error && <div className="form-error" role="alert">{state.error}</div>}
    {state.success && <div className="form-success" role="status">{state.success}</div>}
    <div className="password-entry"><input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} placeholder="New password (minimum 12 characters)" required/><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide new password" : "Show new password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
    <div className="client-password-actions"><button type="button" className="button-secondary" onClick={() => setEditing(false)}>Cancel</button><button className="button-primary" disabled={pending}>{pending ? "Resetting…" : "Save new password"}</button></div>
  </form>;
}
