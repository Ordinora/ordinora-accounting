import "server-only";
import { db } from "./db";
import { getDocumentAIProvider } from "./document-ai";

export async function processAccountingDocument(input: { accountingDocumentId: string; tenantId: string; userId: string; firmId: string; bytes: Uint8Array }) {
  const provider = getDocumentAIProvider();
  const record = await db.accountingDocument.findFirst({ where: { id: input.accountingDocumentId, tenantId: input.tenantId }, include: { document: true } });
  if (!record) throw new Error("Accounting document not found.");
  const job = await db.documentProcessingJob.create({ data: { accountingDocumentId: record.id, stage: "PROCESSING", provider: provider.name, startedAt: new Date() } });
  try {
    await db.accountingDocument.update({ where: { id: record.id }, data: { status: "PROCESSING" } });
    const classification = await provider.classify({ filename: record.document.originalName, mimeType: record.document.contentType, bytes: input.bytes, requestedType: record.requestedType ?? undefined });
    const extraction = await provider.extract({ type: classification.type, filename: record.document.originalName, mimeType: record.document.contentType, bytes: input.bytes });
    const suggestions = await provider.analyzeAccounting({ tenantId: input.tenantId, type: classification.type, extractedData: extraction.data });
    const duplicate = await db.accountingDocument.findFirst({ where: { tenantId: input.tenantId, id: { not: record.id }, document: { checksum: record.document.checksum } }, orderBy: { createdAt: "asc" } });
    await db.$transaction(async (tx) => {
      await tx.accountingDocument.update({ where: { id: record.id }, data: { detectedType: classification.type, classificationConfidence: classification.confidence, status: "REVIEW_REQUIRED", provider: provider.name, model: provider.model, extractedData: { ...extraction.data, fieldConfidences: extraction.fieldConfidences }, validationResults: extraction.validation, duplicateOfId: duplicate?.id, processedAt: new Date() } });
      await tx.documentSuggestion.deleteMany({ where: { accountingDocumentId: record.id, status: "PENDING" } });
      if (suggestions.length) await tx.documentSuggestion.createMany({ data: suggestions.map((suggestion) => ({ accountingDocumentId: record.id, suggestionType: suggestion.type, proposedValue: suggestion.proposedValue, confidence: suggestion.confidence, reason: suggestion.reason })) });
      await tx.documentProcessingJob.update({ where: { id: job.id }, data: { stage: "REVIEW_REQUIRED", completedAt: new Date() } });
      await tx.document.update({ where: { id: record.documentId }, data: { status: "UNDER_REVIEW" } });
      await tx.auditEvent.create({ data: { firmId: input.firmId, tenantId: input.tenantId, actorId: input.userId, actorKind: "STAFF", action: "ACCOUNTING_DOCUMENT_PROCESSED", entityType: "AccountingDocument", entityId: record.id, newValues: { provider: provider.name, model: provider.model, detectedType: classification.type, classificationConfidence: classification.confidence, duplicateOfId: duplicate?.id ?? null, suggestionCount: suggestions.length } } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document processing failed.";
    await db.$transaction([
      db.accountingDocument.update({ where: { id: record.id }, data: { status: "FAILED" } }),
      db.documentProcessingJob.update({ where: { id: job.id }, data: { stage: "FAILED", errorCode: "PROCESSING_FAILED", errorMessage: message, completedAt: new Date() } }),
      db.auditEvent.create({ data: { firmId: input.firmId, tenantId: input.tenantId, actorId: input.userId, actorKind: "STAFF", action: "ACCOUNTING_DOCUMENT_PROCESSING_FAILED", entityType: "AccountingDocument", entityId: record.id, newValues: { error: message } } }),
    ]);
  }
}
