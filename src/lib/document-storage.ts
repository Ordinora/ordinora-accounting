import "server-only";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { deleteDocument, writeDocument } from "@/lib/document-store";
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
