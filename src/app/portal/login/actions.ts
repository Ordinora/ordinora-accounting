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

export type PortalLoginState = { error?: string } | undefined;
const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(8).max(128) });

export async function portalLogin(_state: PortalLoginState, formData: FormData): Promise<PortalLoginState> {
  const input = schema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Enter a valid email address and password." };
  const { emailHash, sourceHash } = await authenticationFingerprint("CLIENT", input.data.email);
  if (!await isAuthenticationAllowed(emailHash, sourceHash)) return { error: AUTHENTICATION_ERROR };
  const user = await db.user.findFirst({ where: { email: { equals: input.data.email, mode: "insensitive" }, kind: "CLIENT" }, include: { tenant: true } });
  const valid = Boolean(user?.isActive && user.tenant?.portalEnabled && user.tenant.status === "ACTIVE" && await bcrypt.compare(input.data.password, user.passwordHash));
  await recordAuthenticationResult({ emailHash, sourceHash, succeeded: valid, firmId: user?.firmId, userId: user?.id });
  if (user && !valid) await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: user.tenant?.id, actorKind: null, action: "PORTAL_LOGIN_FAILED", sourceMetadata: { sourceHash, emailHash } } });
  if (!valid || !user || !user.tenant) return { error: AUTHENTICATION_ERROR };
  if (user.mfaEnrolledAt && user.mfaSecretEncrypted) {
    await beginMfaChallenge(user.id);
    await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: user.tenant.id, actorId: user.id, actorKind: "CLIENT", action: "AUTH_MFA_CHALLENGE_CREATED", entityType: "User", entityId: user.id, sourceMetadata: { sourceHash } } });
    redirect("/portal/login/mfa");
  }
  await db.auditEvent.create({ data: { firmId: user.firmId, tenantId: user.tenant.id, actorId: user.id, actorKind: "CLIENT", action: "PORTAL_LOGIN_SUCCEEDED", sourceMetadata: { sourceHash, emailHash } } });
  await createSession(user.id);
  redirect("/portal");
}
