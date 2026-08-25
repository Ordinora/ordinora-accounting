import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";

export type AuthenticationScope = "STAFF" | "CLIENT";

const WINDOW_MS = 15 * 60 * 1000;
const EMAIL_FAILURE_LIMIT = 5;
const SOURCE_FAILURE_LIMIT = 25;

function digest(scope: AuthenticationScope, kind: "email" | "source", value: string) {
  return createHash("sha256").update(`${scope}:${kind}:${value}`).digest("hex");
}

async function sourceIdentifier() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-real-ip")?.trim()
    ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "local";
}

export async function authenticationFingerprint(scope: AuthenticationScope, email: string) {
  return {
    emailHash: digest(scope, "email", email.trim().toLowerCase()),
    sourceHash: digest(scope, "source", await sourceIdentifier()),
  };
}

export async function isAuthenticationAllowed(emailHash: string, sourceHash: string) {
  const since = new Date(Date.now() - WINDOW_MS);
  const [emailFailures, sourceFailures] = await Promise.all([
    db.loginAttempt.count({ where: { emailHash, succeeded: false, createdAt: { gte: since } } }),
    db.loginAttempt.count({ where: { sourceHash, succeeded: false, createdAt: { gte: since } } }),
  ]);

  return emailFailures < EMAIL_FAILURE_LIMIT && sourceFailures < SOURCE_FAILURE_LIMIT;
}

export async function recordAuthenticationResult(input: {
  emailHash: string;
  sourceHash: string;
  succeeded: boolean;
  firmId?: string;
  userId?: string;
}) {
  await db.$transaction(async (tx) => {
    if (input.succeeded) {
      await tx.loginAttempt.deleteMany({
        where: { emailHash: input.emailHash, succeeded: false },
      });
    }

    await tx.loginAttempt.create({
      data: {
        firmId: input.firmId,
        userId: input.userId,
        emailHash: input.emailHash,
        sourceHash: input.sourceHash,
        succeeded: input.succeeded,
      },
    });
  });
}

export const AUTHENTICATION_ERROR = "Email or password is incorrect, or sign-in is temporarily unavailable.";
