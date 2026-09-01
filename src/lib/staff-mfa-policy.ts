export const staffRolesRequiringMfa = new Set(["SYSTEM_ADMIN"] as const);

type StaffMfaUser = {
  staffRole: string | null;
  mfaEnrolledAt: Date | null;
  mfaSecretEncrypted: string | null;
};

export function staffPasswordAuthenticationAllowed(user: { isActive: boolean } | null | undefined, passwordMatches: boolean) {
  return Boolean(user?.isActive && passwordMatches);
}

export function hasCompletedStaffMfaEnrollment(user: StaffMfaUser) {
  return Boolean(user.mfaEnrolledAt && user.mfaSecretEncrypted);
}

export function requiresStaffMfaEnrollment(user: StaffMfaUser) {
  return user.staffRole === "SYSTEM_ADMIN" && staffRolesRequiringMfa.has(user.staffRole) && !hasCompletedStaffMfaEnrollment(user);
}

export function staffLoginNextStep(user: StaffMfaUser): "MFA_CHALLENGE" | "MFA_ENROLLMENT" | "APPLICATION" {
  if (hasCompletedStaffMfaEnrollment(user)) return "MFA_CHALLENGE";
  return requiresStaffMfaEnrollment(user) ? "MFA_ENROLLMENT" : "APPLICATION";
}
