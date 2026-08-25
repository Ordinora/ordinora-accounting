"use server";

import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { validateAccountingFile } from "@/lib/document-file";
import { deleteDocument } from "@/lib/document-store";
import { quarantineAndScanDocument } from "@/lib/document-storage";
import { requireClient } from "@/lib/session";

export type ClientDocumentUploadState = { error?: string; success?: string };

export async function uploadClientDocument(_state: ClientDocumentUploadState, formData: FormData): Promise<ClientDocumentUploadState> {
  let storedKey: string | undefined;
  try {
    const user = await requireClient();
    const tenant = user.tenant!;
    if (!tenant.documentUploadEnabled) throw new Error("Document uploads are not enabled for this company.");
    const file = formData.get("document");
    if (!(file instanceof File)) throw new Error("Select a document to upload.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateAccountingFile({ name: file.name, type: file.type, size: file.size, bytes });
    if (await db.document.count({ where: { tenantId: tenant.id, checksum: validated.checksum } })) throw new Error("This exact document has already been uploaded.");
    const stored = await quarantineAndScanDocument({ tenantId: tenant.id, storageName: validated.storageName, bytes, contentType: file.type });
    storedKey = stored.storage.storageKey;
    const document = await db.$transaction(async (tx) => {
      const record = await tx.document.create({ data: { tenantId: tenant.id, uploadedById: user.id, originalName: path.basename(file.name).slice(0, 240), storageKey: stored.storage.storageKey, contentType: file.type, sizeBytes: file.size, checksum: validated.checksum, status: stored.released ? "UPLOADED" : "QUARANTINED", scannedAt: new Date(), scanEngine: stored.scan.engine, scanResult: stored.scan.result, quarantineReason: stored.scan.reason ?? null } });
      await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: tenant.id, actorId: user.id, actorKind: "CLIENT", action: stored.released ? "PORTAL_DOCUMENT_UPLOADED" : "DOCUMENT_QUARANTINED", entityType: "Document", entityId: record.id, newValues: { filename: record.originalName, contentType: record.contentType, sizeBytes: record.sizeBytes, scanEngine: stored.scan.engine, scanResult: stored.scan.result } } });
      return record;
    });
    revalidatePath("/portal/documents");
    revalidatePath("/settings/portal/documents");
    if (!stored.released) return { error: "The file did not pass the security scan and was quarantined. Your accountant has been notified in the audit trail." };
    return { success: `${document.originalName} passed the security scan and was sent securely to your accountant.` };
  } catch (error) {
    if (storedKey) await deleteDocument(storedKey).catch(() => undefined);
    return { error: error instanceof Error ? error.message : "The document could not be uploaded." };
  }
}
