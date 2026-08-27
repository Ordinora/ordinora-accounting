import { AppShell } from "@/components/app-shell";
import { ProfileSettingsForm } from "@/components/profile-settings-form";
import { requireActiveTenant } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { user, tenants, active } = await requireActiveTenant();
  const role = user.staffRole?.replaceAll("_", " ") ?? "STAFF";
  return <AppShell
    user={{ displayName: user.displayName, email: user.email, role, firmName: user.firm.name }}
    tenants={tenants} activeTenant={active} pageTitle="Profile & settings"
    pageDescription="Manage your personal account details and sign-in password"
  >
    <main className="module-page">
      <header className="module-header"><div><p className="eyebrow">MY ACCOUNT</p><h2>Profile & settings</h2><p>Your email address and access role are controlled by the System Administrator.</p></div></header>
      <ProfileSettingsForm displayName={user.displayName} email={user.email} role={role}/>
    </main>
  </AppShell>;
}
