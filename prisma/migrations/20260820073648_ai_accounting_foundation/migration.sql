-- CreateEnum
CREATE TYPE "AccountingDocumentType" AS ENUM ('PURCHASE_INVOICE', 'SALES_INVOICE', 'RECEIPT', 'EXPENSE_CLAIM', 'BANK_STATEMENT', 'DELIVERY_ORDER', 'CREDIT_NOTE', 'DEBIT_NOTE', 'SUPPLIER_STATEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "AIProcessingStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'OCR_PROCESSING', 'EXTRACTING', 'VALIDATING', 'MATCHING', 'CATEGORISING', 'REVIEW_REQUIRED', 'APPROVED', 'POSTED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AISuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');

-- CreateTable
CREATE TABLE "AccountingDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "requestedType" "AccountingDocumentType",
    "detectedType" "AccountingDocumentType",
    "confirmedType" "AccountingDocumentType",
    "classificationConfidence" DECIMAL(7,4),
    "status" "AIProcessingStatus" NOT NULL DEFAULT 'UPLOADED',
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "extractedData" JSONB,
    "confirmedData" JSONB,
    "validationResults" JSONB,
    "duplicateOfId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "postedEntityType" TEXT,
    "postedEntityId" TEXT,
    "processedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountingDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentProcessingJob" (
    "id" TEXT NOT NULL,
    "accountingDocumentId" TEXT NOT NULL,
    "stage" "AIProcessingStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSuggestion" (
    "id" TEXT NOT NULL,
    "accountingDocumentId" TEXT NOT NULL,
    "suggestionType" TEXT NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "confirmedValue" JSONB,
    "confidence" DECIMAL(7,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AISuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingDocument_documentId_key" ON "AccountingDocument"("documentId");

-- CreateIndex
CREATE INDEX "AccountingDocument_tenantId_status_createdAt_idx" ON "AccountingDocument"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AccountingDocument_tenantId_detectedType_idx" ON "AccountingDocument"("tenantId", "detectedType");

-- CreateIndex
CREATE INDEX "DocumentProcessingJob_accountingDocumentId_createdAt_idx" ON "DocumentProcessingJob"("accountingDocumentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentSuggestion_accountingDocumentId_status_idx" ON "DocumentSuggestion"("accountingDocumentId", "status");

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingDocument" ADD CONSTRAINT "AccountingDocument_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "AccountingDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentProcessingJob" ADD CONSTRAINT "DocumentProcessingJob_accountingDocumentId_fkey" FOREIGN KEY ("accountingDocumentId") REFERENCES "AccountingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSuggestion" ADD CONSTRAINT "DocumentSuggestion_accountingDocumentId_fkey" FOREIGN KEY ("accountingDocumentId") REFERENCES "AccountingDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
