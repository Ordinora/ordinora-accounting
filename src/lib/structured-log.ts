import "server-only";

type LogLevel = "info" | "warn" | "error";
const sensitive = /(password|secret|token|authorization|cookie|database.?url|api.?key)/i;

function safeValue(key: string, value: unknown): unknown {
  if (sensitive.test(key)) return "[REDACTED]";
  if (typeof value === "string") return value.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[REDACTED]@").slice(0, 1000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => safeValue(key, item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0, 50).map(([childKey, child]) => [childKey, safeValue(childKey, child)]));
  return String(value).slice(0, 1000);
}

export function structuredLog(level: LogLevel, event: string, metadata: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, service: "ordinora", environment: process.env.NODE_ENV || "development", event, ...(safeValue("metadata", metadata) as Record<string, unknown>) });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function safeError(error: unknown) {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  return { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : "Unknown server error", digest };
}
