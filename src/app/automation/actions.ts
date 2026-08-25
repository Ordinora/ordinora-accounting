"use server";

import path from "node:path";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AccountingDocumentType, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateAccountingFile } from "@/lib/document-file";
import { deleteDocument, readDocument } from "@/lib/document-store";
import { quarantineAndScanDocument } from "@/lib/document-storage";
import { processAccountingDocument } from "@/lib/document-processing";
import { documentUploadsEnabled } from "@/lib/operational-config";
import { requireActiveTenant } from "@/lib/session";

export type UploadDocumentState = { error?: string };

function authorize(role: string | null) {
  if (!role || !["SYSTEM_ADMIN", "FIRM_ADMIN", "ACCOUNTANT", "REVIEWER"].includes(role)) {
    throw new Error("Your role cannot process accounting documents.");
  }
}

const requestedTypes = ["AUTO", ...Object.values(AccountingDocumentType)] as const;

export async function uploadAccountingDocument(_state: UploadDocumentState, formData: FormData): Promise<UploadDocumentState> {
  let createdId: string | undefined;
  try {
    if (!documentUploadsEnabled()) throw new Error("Document uploads are temporarily disabled for this deployment.");
    const { user, active } = await requireActiveTenant();
    authorize(user.staffRole);
    const requested = z.enum(requestedTypes).parse(formData.get("requestedType"));
    const file = formData.get("document");
    if (!(file instanceof File)) throw new Error("Select a document to upload.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = validateAccountingFile({ name: file.name, type: file.type, size: file.size, bytes });
    const stored = await quarantineAndScanDocument({ tenantId: active.id, storageName: validated.storageName, bytes, contentType: file.type });
    try {
      const record = await db.$transaction(async (tx) => {
        const document = await tx.document.create({ data: { tenantId: active.id, uploadedById: user.id, originalName: path.basename(file.name).slice(0, 240), storageKey: stored.storage.storageKey, contentType: file.type, sizeBytes: file.size, checksum: validated.checksum, status: stored.released ? "UPLOADED" : "QUARANTINED", scannedAt: new Date(), scanEngine: stored.scan.engine, scanResult: stored.scan.result, quarantineReason: stored.scan.reason ?? null } });
        if (!stored.released) {
          await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "DOCUMENT_QUARANTINED", entityType: "Document", entityId: document.id, newValues: { filename: document.originalName, scanEngine: stored.scan.engine, scanResult: stored.scan.result } } });
          return null;
        }
        const accountingDocument = await tx.accountingDocument.create({ data: { tenantId: active.id, documentId: document.id, requestedType: requested === "AUTO" ? null : requested, provider: process.env.DOCUMENT_AI_PROVIDER || "mock" } });
        await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNTING_DOCUMENT_UPLOADED", entityType: "AccountingDocument", entityId: accountingDocument.id, newValues: { filename: document.originalName, contentType: document.contentType, sizeBytes: document.sizeBytes, checksum: document.checksum, requestedType: requested } } });
        return accountingDocument;
      });
      if (!record) return { error: "The file did not pass the security scan and was quarantined. Your administrator can review the audit record." };
      createdId = record.id;
      await processAccountingDocument({ accountingDocumentId: record.id, tenantId: active.id, userId: user.id, firmId: user.firmId, bytes });
    } catch (error) {
      if (!createdId) await deleteDocument(stored.storage.storageKey);
      throw error;
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The document could not be uploaded." };
  }
  redirect(`/automation/${createdId}`);
}

export async function confirmAccountingDocument(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("accountingDocumentId"));
  const confirmedType = z.nativeEnum(AccountingDocumentType).parse(formData.get("confirmedType"));
  const record = await db.accountingDocument.findFirst({ where: { id, tenantId: active.id, status: "REVIEW_REQUIRED" } });
  if (!record?.extractedData) throw new Error("Only a processed document awaiting review can be confirmed.");
  await db.$transaction(async (tx) => {
    await tx.accountingDocument.update({ where: { id }, data: { confirmedType, confirmedData: record.extractedData as Prisma.InputJsonValue, status: "APPROVED", reviewedById: user.id, reviewedAt: new Date() } });
    await tx.documentSuggestion.updateMany({ where: { accountingDocumentId: id, status: "PENDING" }, data: { status: "ACCEPTED", reviewedById: user.id, reviewedAt: new Date() } });
    await tx.document.update({ where: { id: record.documentId }, data: { status: "ACCEPTED" } });
    await tx.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNTING_DOCUMENT_CONFIRMED", entityType: "AccountingDocument", entityId: id, newValues: { confirmedType, accountingPosted: false } } });
  });
  revalidatePath(`/automation/${id}`);
  revalidatePath("/automation");
}

export async function retryAccountingDocument(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("accountingDocumentId"));
  const record = await db.accountingDocument.findFirst({ where: { id, tenantId: active.id }, include: { document: true } });
  if (!record || !["FAILED", "REVIEW_REQUIRED"].includes(record.status)) throw new Error("This document cannot be reprocessed.");
  if (record.document.status === "QUARANTINED" || record.document.status === "SCAN_PENDING") throw new Error("A quarantined document cannot be processed.");
  const bytes = await readDocument(record.document.storageKey);
  await processAccountingDocument({ accountingDocumentId: id, tenantId: active.id, userId: user.id, firmId: user.firmId, bytes });
  revalidatePath(`/automation/${id}`);
  revalidatePath("/automation");
}

export async function cancelAccountingDocument(formData: FormData) {
  const { user, active } = await requireActiveTenant();
  authorize(user.staffRole);
  const id = z.string().min(1).parse(formData.get("accountingDocumentId"));
  const record = await db.accountingDocument.findFirst({ where: { id, tenantId: active.id, status: { notIn: ["POSTED", "CANCELLED"] } } });
  if (!record) throw new Error("This document cannot be cancelled.");
  await db.$transaction([
    db.accountingDocument.update({ where: { id }, data: { status: "CANCELLED", reviewedById: user.id, reviewedAt: new Date() } }),
    db.document.update({ where: { id: record.documentId }, data: { status: "ARCHIVED" } }),
    db.auditEvent.create({ data: { firmId: user.firmId, tenantId: active.id, actorId: user.id, actorKind: "STAFF", action: "ACCOUNTING_DOCUMENT_CANCELLED", entityType: "AccountingDocument", entityId: id } }),
  ]);
  revalidatePath(`/automation/${id}`);
  revalidatePath("/automation");
}
