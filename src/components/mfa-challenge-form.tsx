"use client";

import { useActionState } from "react";
import type { MfaState } from "@/lib/mfa-challenge";

export function MfaChallengeForm({ action }: { action: (state: MfaState, formData: FormData) => Promise<MfaState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return <form action={formAction} className="login-form"><label htmlFor="mfa-code">Authenticator or recovery code</label><div className="input-wrap"><input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" required autoFocus maxLength={32}/></div>{state?.error && <p className="form-error" role="alert">{state.error}</p>}<button className="login-button" disabled={pending}>{pending ? "Verifying…" : "Verify and continue"}</button></form>;
}
