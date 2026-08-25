import type { AccountingDocumentType, Prisma } from "@prisma/client";

export type ClassificationResult = {
  type: AccountingDocumentType;
  confidence: number;
  reason: string;
};

export type ExtractionResult = {
  data: Prisma.InputJsonObject;
  fieldConfidences: Record<string, number>;
  validation: Prisma.InputJsonObject;
};

export type AccountingSuggestion = {
  type: string;
  proposedValue: Prisma.InputJsonObject;
  confidence: number;
  reason: string;
};

export interface DocumentAIProvider {
  readonly name: string;
  readonly model: string;
  classify(input: { filename: string; mimeType: string; bytes?: Uint8Array; requestedType?: AccountingDocumentType }): Promise<ClassificationResult>;
  extract(input: { type: AccountingDocumentType; filename: string; mimeType: string; bytes: Uint8Array }): Promise<ExtractionResult>;
  analyzeAccounting(input: { tenantId: string; type: AccountingDocumentType; extractedData: Prisma.InputJsonObject }): Promise<AccountingSuggestion[]>;
}
