-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'INTER_ACCOUNT_TRANSFER';

-- CreateTable
CREATE TABLE "InterAccountTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "sourceAccountId" TEXT NOT NULL,
    "destinationAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "transferDate" DATE NOT NULL,
    "description" TEXT,
    "sourceCurrency" TEXT NOT NULL,
    "sourceAmount" DECIMAL(19,4) NOT NULL,
    "sourceExchangeRate" DECIMAL(24,12) NOT NULL,
    "sourceBaseAmount" DECIMAL(19,4) NOT NULL,
    "destinationCurrency" TEXT NOT NULL,
    "destinationAmount" DECIMAL(19,4) NOT NULL,
    "destinationExchangeRate" DECIMAL(24,12) NOT NULL,
    "destinationBaseAmount" DECIMAL(19,4) NOT NULL,
    "realizedFxBase" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterAccountTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterAccountTransfer_journalId_key" ON "InterAccountTransfer"("journalId");

-- CreateIndex
CREATE INDEX "InterAccountTransfer_tenantId_transferDate_idx" ON "InterAccountTransfer"("tenantId", "transferDate");

-- CreateIndex
CREATE INDEX "InterAccountTransfer_sourceAccountId_idx" ON "InterAccountTransfer"("sourceAccountId");

-- CreateIndex
CREATE INDEX "InterAccountTransfer_destinationAccountId_idx" ON "InterAccountTransfer"("destinationAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "InterAccountTransfer_tenantId_reference_key" ON "InterAccountTransfer"("tenantId", "reference");

-- AddForeignKey
ALTER TABLE "InterAccountTransfer" ADD CONSTRAINT "InterAccountTransfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAccountTransfer" ADD CONSTRAINT "InterAccountTransfer_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAccountTransfer" ADD CONSTRAINT "InterAccountTransfer_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterAccountTransfer" ADD CONSTRAINT "InterAccountTransfer_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
