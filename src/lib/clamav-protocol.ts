import type { DocumentScanResult } from "./document-scanner-types";

export function clamAvResponseComplete(response: string) {
  return response.includes("\0");
}

export function parseClamAvResponse(response: string): DocumentScanResult {
  const terminator = response.indexOf("\0");
  const text = response.slice(0, terminator >= 0 ? terminator : undefined).trim();
  if (text.endsWith("OK")) return { clean: true, engine: "clamav-daemon", result: "CLEAN" };
  if (text.includes("FOUND")) return { clean: false, engine: "clamav-daemon", result: "MALWARE_DETECTED", reason: text.slice(0, 500) };
  throw new Error(`The malware scanner returned an invalid response${text ? `: ${text.slice(0, 300)}` : "."}`);
}
