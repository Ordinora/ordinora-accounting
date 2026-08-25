import "server-only";

import { spawn } from "node:child_process";
import { createConnection } from "node:net";

export type DocumentScanResult = { clean: boolean; engine: string; result: string; reason?: string };

export function basicDocumentScan(bytes: Uint8Array, contentType: string): DocumentScanResult {
  const ascii = Buffer.from(bytes).toString("latin1");
  if (ascii.includes("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) return { clean: false, engine: "ordinora-basic", result: "MALWARE_TEST_SIGNATURE", reason: "The file matched a malware test signature." };
  if (contentType === "application/pdf" && /\/(JavaScript|JS|Launch|EmbeddedFile)\b/i.test(ascii)) {
    return { clean: false, engine: "ordinora-basic", result: "ACTIVE_PDF_CONTENT", reason: "Active or embedded PDF content is not permitted." };
  }
  return { clean: true, engine: "ordinora-basic", result: "CLEAN_BASIC" };
}

async function clamAvScan(filePath: string): Promise<DocumentScanResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("clamscan", ["--no-summary", "--infected", "--", filePath], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.stderr.on("data", (chunk) => { output += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ clean: true, engine: "clamav", result: "CLEAN" });
      else if (code === 1) resolve({ clean: false, engine: "clamav", result: "MALWARE_DETECTED", reason: output.trim().slice(0, 500) || "Malware was detected." });
      else reject(new Error("The malware scanner could not complete."));
    });
  });
}

async function clamAvDaemonScan(bytes: Uint8Array): Promise<DocumentScanResult> {
  const host = process.env.CLAMAV_HOST!;
  const port = Number(process.env.CLAMAV_PORT || "3310");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("CLAMAV_PORT must be a valid TCP port.");
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    let response = "", settled = false;
    const finish = (error?: Error, result?: DocumentScanResult) => { if (settled) return; settled = true; socket.destroy(); if (error) reject(error); else resolve(result!); };
    socket.setTimeout(15_000, () => finish(new Error("The malware scanner timed out.")));
    socket.on("error", () => finish(new Error("The malware scanner is unavailable.")));
    socket.on("data", (chunk) => { response += String(chunk); });
    socket.on("end", () => {
      const text = response.trim();
      if (text.endsWith("OK")) finish(undefined, { clean: true, engine: "clamav-daemon", result: "CLEAN" });
      else if (text.includes("FOUND")) finish(undefined, { clean: false, engine: "clamav-daemon", result: "MALWARE_DETECTED", reason: text.slice(0, 500) });
      else finish(new Error("The malware scanner returned an invalid response."));
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      const buffer = Buffer.from(bytes);
      for (let offset = 0; offset < buffer.length; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.length));
        const length = Buffer.allocUnsafe(4); length.writeUInt32BE(chunk.length); socket.write(length); socket.write(chunk);
      }
      const end = Buffer.alloc(4); end.writeUInt32BE(0); socket.end(end);
    });
  });
}

export async function scanDocument(input: { filePath: string; bytes: Uint8Array; contentType: string }): Promise<DocumentScanResult> {
  const structural = basicDocumentScan(input.bytes, input.contentType);
  if (!structural.clean) return structural;
  const mode = (process.env.DOCUMENT_MALWARE_SCAN_MODE || "basic").toLowerCase();
  if (mode === "basic") return structural;
  if (mode === "clamav") return process.env.CLAMAV_HOST ? clamAvDaemonScan(input.bytes) : clamAvScan(input.filePath);
  throw new Error("DOCUMENT_MALWARE_SCAN_MODE must be basic or clamav.");
}
