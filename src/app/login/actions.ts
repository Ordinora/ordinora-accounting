"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  AUTHENTICATION_ERROR,
  authenticationFingerprint,
  isAuthenticationAllowed,
  recordAuthenticationResult,
} from "@/lib/authentication-throttle";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { beginMfaChallenge } from "@/lib/mfa-challenge";

export type LoginState = { error?: string } | undefined;
const inputSchema = z.object({ email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()), password: z.string().min(8).max(128) });

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = inputSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Enter a valid email address and password." };
  const { emailHash, sourceHash } = await authenticationFingerprint("STAFF", parsed.data.email);
  if (!await isAuthenticationAllowed(emailHash, sourceHash)) return { error: AUTHENTICATION_ERROR };

  const user = await db.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" }, kind: "STAFF" } });
  const valid = Boolean(user?.isActive && await bcrypt.compare(parsed.data.password, user.passwordHash));
  await recordAuthenticationResult({ emailHash, sourceHash, succeeded: valid, firmId: user?.firmId, userId: user?.id });
  if (user && !valid) await db.auditEvent.create({ data: { firmId: user.firmId, actorKind: null, action: "AUTH_LOGIN_FAILED", sourceMetadata: { sourceHash, emailHash } } });
  if (!valid || !user) return { error: AUTHENTICATION_ERROR };
  if (user.mfaEnrolledAt && user.mfaSecretEncrypted) {
    await beginMfaChallenge(user.id);
    await db.auditEvent.create({ data: { firmId: user.firmId, actorId: user.id, actorKind: "STAFF", action: "AUTH_MFA_CHALLENGE_CREATED", entityType: "User", entityId: user.id, sourceMetadata: { sourceHash } } });
    redirect("/login/mfa");
  }
  await db.auditEvent.create({ data: { firmId: user.firmId, actorId: user.id, actorKind: "STAFF", action: "AUTH_LOGIN_SUCCEEDED", sourceMetadata: { sourceHash, emailHash } } });
  await createSession(user.id);
  redirect("/");
}
