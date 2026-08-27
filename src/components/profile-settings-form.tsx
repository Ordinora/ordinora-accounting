"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, type ProfileActionState } from "@/app/profile/actions";

const initialState: ProfileActionState = {};

function Message({ state }: { state: ProfileActionState }) {
  if (state.error) return <div className="form-error" role="alert">{state.error}</div>;
  if (state.success) return <div className="form-success" role="status">{state.success}</div>;
  return null;
}

export function ProfileSettingsForm({ displayName, email, role }: { displayName: string; email: string; role: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, initialState);
  return <div className="profile-settings-stack">
    <section className="form-card">
      <div className="form-card-heading"><div><h3>Personal details</h3><p>Update the name displayed throughout Ordinora.</p></div></div>
      <form action={profileAction} className="compact-form-body">
        <Message state={profileState}/>
        <div className="form-grid profile-form-grid">
          <label>Display name<input name="displayName" defaultValue={displayName} required minLength={2} maxLength={120}/></label>
          <label>Email address<input value={email} readOnly aria-readonly="true"/></label>
          <label>Access role<input value={role} readOnly aria-readonly="true"/></label>
        </div>
        <div className="form-actions"><button className="button-primary" disabled={profilePending}>{profilePending ? "Saving…" : "Save profile"}</button></div>
      </form>
    </section>
    <section className="form-card">
      <div className="form-card-heading"><div><h3>Change password</h3><p>Use at least 14 characters and do not reuse your current password.</p></div></div>
      <form action={passwordAction} className="compact-form-body">
        <Message state={passwordState}/>
        <div className="form-grid profile-form-grid">
          <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required/></label>
          <label>New password<input name="newPassword" type="password" autoComplete="new-password" required minLength={14}/></label>
          <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={14}/></label>
        </div>
        <div className="form-actions"><button className="button-primary" disabled={passwordPending}>{passwordPending ? "Changing…" : "Change password"}</button></div>
      </form>
    </section>
  </div>;
}
