import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { createSession, hashToken } from "./session";
import { decryptMfaSecret, recoveryCodeHash, verifyTotp } from "./mfa";

const MFA_COOKIE = "ordinora_mfa_challenge";
const CHALLENGE_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type MfaState = { error?: string } | undefined;

export async function beginMfaChallenge(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.$transaction([
    db.mfaChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } }),
    db.mfaChallenge.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + CHALLENGE_MS) } }),
  ]);
  (await cookies()).set(MFA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: CHALLENGE_MS / 1000 });
}

export async function completeMfaChallenge(expectedKind: "STAFF" | "CLIENT", formData: FormData): Promise<MfaState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code || code.length > 32) return { error: "Enter the six-digit authenticator code or a recovery code." };
  const jar = await cookies();
  const token = jar.get(MFA_COOKIE)?.value;
  if (!token) return { error: "This verification request expired. Sign in again." };
  const now = new Date();
  const challenge = await db.mfaChallenge.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.attempts >= MAX_ATTEMPTS || challenge.user.kind !== expectedKind || !challenge.user.isActive || !challenge.user.mfaSecretEncrypted) {
    jar.delete(MFA_COOKIE);
    return { error: "This verification request expired. Sign in again." };
  }

  const normalizedRecovery = recoveryCodeHash(code);
  const recoveryIndex = challenge.user.mfaRecoveryCodeHashes.indexOf(normalizedRecovery);
  const valid = verifyTotp(decryptMfaSecret(challenge.user.mfaSecretEncrypted), code) || recoveryIndex >= 0;
  if (!valid) {
    await db.mfaChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 }, ...(challenge.attempts + 1 >= MAX_ATTEMPTS ? { consumedAt: now } : {}) } });
    if (challenge.attempts + 1 >= MAX_ATTEMPTS) jar.delete(MFA_COOKIE);
    return { error: challenge.attempts + 1 >= MAX_ATTEMPTS ? "Too many verification attempts. Sign in again." : "The verification code is incorrect." };
  }

  await db.$transaction(async (tx) => {
    await tx.mfaChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
    if (recoveryIndex >= 0) await tx.user.update({ where: { id: challenge.user.id }, data: { mfaRecoveryCodeHashes: challenge.user.mfaRecoveryCodeHashes.filter((_, index) => index !== recoveryIndex) } });
    await tx.auditEvent.create({ data: { firmId: challenge.user.firmId, tenantId: challenge.user.tenantId, actorId: challenge.user.id, actorKind: challenge.user.kind, action: recoveryIndex >= 0 ? "AUTH_MFA_RECOVERY_SUCCEEDED" : "AUTH_MFA_SUCCEEDED", entityType: "User", entityId: challenge.user.id } });
  });
  jar.delete(MFA_COOKIE);
  await createSession(challenge.user.id);
  redirect(expectedKind === "STAFF" ? "/" : "/portal");
}

export async function hasMfaChallenge(expectedKind: "STAFF" | "CLIENT") {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return false;
  const now = new Date();
  return Boolean(await db.mfaChallenge.count({ where: { tokenHash: hashToken(token), consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_ATTEMPTS }, user: { kind: expectedKind, isActive: true } } }));
}
