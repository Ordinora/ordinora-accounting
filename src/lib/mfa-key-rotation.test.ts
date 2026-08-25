import { afterEach, describe, expect, it } from "vitest";
import { decryptMfaSecret, encryptMfaSecret } from "./mfa";

const originalActive = process.env.MFA_ENCRYPTION_KEY;
const originalPrevious = process.env.MFA_ENCRYPTION_KEY_PREVIOUS;

afterEach(() => {
  if (originalActive === undefined) delete process.env.MFA_ENCRYPTION_KEY; else process.env.MFA_ENCRYPTION_KEY = originalActive;
  if (originalPrevious === undefined) delete process.env.MFA_ENCRYPTION_KEY_PREVIOUS; else process.env.MFA_ENCRYPTION_KEY_PREVIOUS = originalPrevious;
});

describe("MFA deployment-key rotation", () => {
  it("decrypts existing secrets with a temporary previous key while new secrets use the active key", () => {
    const previous = "previous-mfa-encryption-key-that-is-long-enough";
    const active = "active-mfa-encryption-key-that-is-also-long-enough";
    process.env.MFA_ENCRYPTION_KEY = previous;
    const existing = encryptMfaSecret("JBSWY3DPEHPK3PXP");
    process.env.MFA_ENCRYPTION_KEY = active;
    process.env.MFA_ENCRYPTION_KEY_PREVIOUS = previous;
    expect(decryptMfaSecret(existing)).toBe("JBSWY3DPEHPK3PXP");
    const replacement = encryptMfaSecret("KRUGS4ZANFZSAYJA");
    delete process.env.MFA_ENCRYPTION_KEY_PREVIOUS;
    expect(decryptMfaSecret(replacement)).toBe("KRUGS4ZANFZSAYJA");
  });
});
