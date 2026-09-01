import { describe, expect, it } from "vitest";
import { requiresStaffMfaEnrollment, staffLoginNextStep, staffPasswordAuthenticationAllowed, staffRolesRequiringMfa } from "./staff-mfa-policy";

describe("staff MFA policy", () => {
  it("requires an unenrolled SYSTEM_ADMIN to enroll before application access", () => {
    const user = { staffRole: "SYSTEM_ADMIN", mfaEnrolledAt: null, mfaSecretEncrypted: null };
    expect(staffLoginNextStep(user)).toBe("MFA_ENROLLMENT");
    expect(requiresStaffMfaEnrollment(user)).toBe(true);
  });

  it("sends an enrolled SYSTEM_ADMIN through the normal MFA challenge", () => {
    expect(staffLoginNextStep({ staffRole: "SYSTEM_ADMIN", mfaEnrolledAt: new Date(), mfaSecretEncrypted: "encrypted" })).toBe("MFA_CHALLENGE");
  });

  it("keeps MFA optional for other staff roles", () => {
    expect(staffLoginNextStep({ staffRole: "ACCOUNTANT", mfaEnrolledAt: null, mfaSecretEncrypted: null })).toBe("APPLICATION");
    expect([...staffRolesRequiringMfa]).toEqual(["SYSTEM_ADMIN"]);
  });

  it("rejects a deactivated user even when the password matches", () => {
    expect(staffPasswordAuthenticationAllowed({ isActive: false }, true)).toBe(false);
    expect(staffPasswordAuthenticationAllowed({ isActive: true }, true)).toBe(true);
    expect(staffPasswordAuthenticationAllowed({ isActive: true }, false)).toBe(false);
  });
});
