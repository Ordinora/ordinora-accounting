import { randomUUID, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { checkDocumentStorage } from "@/lib/document-store";
import { validateOperationalConfig } from "@/lib/operational-config";
import { safeError, structuredLog } from "@/lib/structured-log";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  if (process.env.NODE_ENV !== "production" && !process.env.HEALTH_CHECK_TOKEN) return true;
  const expected = process.env.HEALTH_CHECK_TOKEN || "", supplied = request.headers.get("x-health-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function within<T>(promise: Promise<T>, milliseconds: number) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Readiness check timed out.")), milliseconds))]);
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ status: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const requestId = randomUUID(), checks = { configuration: false, database: false, storage: false };
  try {
    const configuration = validateOperationalConfig(process.env);
    checks.configuration = configuration.errors.length === 0;
    await within(db.$queryRaw`SELECT 1`, 3000);
    checks.database = true;
    await within(checkDocumentStorage(), 3000);
    checks.storage = true;
    const ready = Object.values(checks).every(Boolean);
    if (!ready) structuredLog("warn", "health.not_ready", { requestId, checks });
    return Response.json({ status: ready ? "ready" : "not_ready", checks, requestId, timestamp: new Date().toISOString() }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    structuredLog("error", "health.failed", { requestId, checks, error: safeError(error) });
    return Response.json({ status: "not_ready", checks, requestId, timestamp: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
