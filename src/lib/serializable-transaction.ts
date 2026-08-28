import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "./db";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_WAIT_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function isRetryableSerializationFailure(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

function isDuplicateReference(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  return Array.isArray(target) && target.includes("tenantId") && target.includes("reference");
}

export async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: DEFAULT_MAX_WAIT_MS,
        timeout: DEFAULT_TIMEOUT_MS,
      });
    } catch (error) {
      if (isDuplicateReference(error)) throw new Error("A transaction with this reference already exists.");
      if (!isRetryableSerializationFailure(error) || attempt === maxAttempts) throw error;
    }
  }

  throw new Error("The accounting transaction could not be completed after retrying.");
}
