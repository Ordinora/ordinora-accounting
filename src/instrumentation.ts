import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const [{ assertOperationalConfig }, { structuredLog }] = await Promise.all([import("@/lib/operational-config"), import("@/lib/structured-log")]);
  const result = assertOperationalConfig();
  for (const warning of result.warnings) structuredLog("warn", "configuration.warning", { warning });
  structuredLog("info", "application.started", { instance: process.env.INSTANCE_ID || "local" });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { safeError, structuredLog } = await import("@/lib/structured-log");
  structuredLog("error", "request.failed", { error: safeError(error), method: request.method, path: request.path.split("?")[0], routePath: context.routePath, routeType: context.routeType });
};
