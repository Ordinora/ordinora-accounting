ALTER TABLE "Payment"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD COLUMN "chequeNumber" TEXT,
  ADD COLUMN "chequeDate" DATE,
  ADD COLUMN "chequeStatus" TEXT,
  ADD COLUMN "chequeClearedOn" DATE,
  ADD COLUMN "chequeReturnedOn" DATE,
  ADD COLUMN "chequeReturnReason" TEXT,
  ADD COLUMN "chequeReturnJournalId" TEXT;

ALTER TABLE "SupplierPayment"
  ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
  ADD COLUMN "chequeNumber" TEXT,
  ADD COLUMN "chequeDate" DATE,
  ADD COLUMN "chequeStatus" TEXT,
  ADD COLUMN "chequeClearedOn" DATE,
  ADD COLUMN "chequeReturnedOn" DATE,
  ADD COLUMN "chequeReturnReason" TEXT,
  ADD COLUMN "chequeReturnJournalId" TEXT;

CREATE UNIQUE INDEX "Payment_tenantId_bankAccountId_chequeNumber_key"
  ON "Payment"("tenantId", "bankAccountId", "chequeNumber") WHERE "chequeNumber" IS NOT NULL;
CREATE UNIQUE INDEX "SupplierPayment_tenantId_bankAccountId_chequeNumber_key"
  ON "SupplierPayment"("tenantId", "bankAccountId", "chequeNumber") WHERE "chequeNumber" IS NOT NULL;
