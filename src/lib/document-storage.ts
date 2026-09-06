import "server-only";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deleteDocument, readDocument, writeDocument } from "@/lib/document-store";
import { scanDocument } from "@/lib/document-scanner";

export async function quarantineAndScanDocument(input: { tenantId: string; storageName: string; bytes: Uint8Array; contentType: string }) {
  const quarantine = { storageKey: `${input.tenantId}/quarantine/${path.basename(input.storageName)}` };
  const accepted = { storageKey: `${input.tenantId}/accepted/${path.basename(input.storageName)}` };
  await writeDocument(quarantine.storageKey, input.bytes, input.contentType);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "ordinora-scan-"));
  const temporaryFile = path.join(temporary, path.basename(input.storageName));
  try {
    await writeFile(temporaryFile, input.bytes, { flag: "wx", mode: 0o600 });
    let scan;
    try {
      scan = await scanDocument({ filePath: temporaryFile, bytes: input.bytes, contentType: input.contentType });
    } catch {
      scan = { clean: false, engine: "unavailable", result: "SCAN_ERROR", reason: "The malware scanner was unavailable. The file remains quarantined." };
    }
    if (!scan.clean) return { storage: quarantine, scan, released: false as const };
    await writeDocument(accepted.storageKey, input.bytes, input.contentType);
    await deleteDocument(quarantine.storageKey);
    return { storage: accepted, scan, released: true as const };
  } catch (error) {
    await deleteDocument(quarantine.storageKey).catch(() => undefined);
    await deleteDocument(accepted.storageKey).catch(() => undefined);
    throw error;
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function rescanQuarantinedDocument(input: { storageKey: string; contentType: string }) {
  if (!input.storageKey.includes("/quarantine/")) throw new Error("Only quarantined documents can be rescanned.");
  const bytes = await readDocument(input.storageKey);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "ordinora-rescan-"));
  const temporaryFile = path.join(temporary, path.basename(input.storageKey));
  try {
    await writeFile(temporaryFile, bytes, { flag: "wx", mode: 0o600 });
    const scan = await scanDocument({ filePath: temporaryFile, bytes, contentType: input.contentType });
    if (!scan.clean) return { storageKey: input.storageKey, scan, released: false as const };
    const acceptedKey = input.storageKey.replace("/quarantine/", "/accepted/");
    await writeDocument(acceptedKey, bytes, input.contentType);
    await deleteDocument(input.storageKey);
    return { storageKey: acceptedKey, scan, released: true as const };
  } finally {
    await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}
