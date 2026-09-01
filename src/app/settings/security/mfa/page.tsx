import { AppShell } from "@/components/app-shell";
import { FirmAdminShell } from "@/components/firm-admin-shell";
import { MfaEnrollmentPanel } from "@/components/mfa-enrollment-panel";
import { enrollmentDetails } from "@/lib/mfa-enrollment";
import { getAuthorizedTenant, requireStaff } from "@/lib/session";
import { startStaffMfa, verifyStaffEnrollment } from "./actions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await requireStaff({ allowMfaEnrollment: true });
  if (user.staffRole !== "SYSTEM_ADMIN") throw new Error("Only the System Administrator can manage multi-factor authentication.");
  const { tenants, active } = await getAuthorizedTenant(user);
  const details = enrollmentDetails(user.email, user.mfaPendingSecretEncrypted);
  const content = <main className="module-page form-page"><MfaEnrollmentPanel enrolled={Boolean(user.mfaEnrolledAt && user.mfaSecretEncrypted)} secret={details?.secret} uri={details?.uri} startAction={startStaffMfa} verifyAction={verifyStaffEnrollment} /></main>;
  const shellUser = { displayName: user.displayName, email: user.email, role: user.staffRole.replaceAll("_", " "), firmName: user.firm.name };
  return active
    ? <AppShell user={shellUser} tenants={tenants} activeTenant={active} pageTitle="Multi-Factor Authentication" pageDescription="Required protection for the System Administrator account">{content}</AppShell>
    : <FirmAdminShell user={shellUser} pageTitle="Multi-Factor Authentication" pageDescription="Required protection for the System Administrator account">{content}</FirmAdminShell>;
}
