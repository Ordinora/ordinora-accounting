-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'FIXED_ASSET_DISPOSAL';

-- CreateTable
CREATE TABLE "FixedAssetDisposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "disposalDate" DATE NOT NULL,
    "proceeds" DECIMAL(19,4) NOT NULL,
    "accumulatedDepreciation" DECIMAL(19,4) NOT NULL,
    "netBookValue" DECIMAL(19,4) NOT NULL,
    "gainLoss" DECIMAL(19,4) NOT NULL,
    "proceedsAccountId" TEXT NOT NULL,
    "gainAccountId" TEXT,
    "lossAccountId" TEXT,
    "journalId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAssetDisposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDisposal_fixedAssetId_key" ON "FixedAssetDisposal"("fixedAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAssetDisposal_journalId_key" ON "FixedAssetDisposal"("journalId");

-- CreateIndex
CREATE INDEX "FixedAssetDisposal_tenantId_disposalDate_idx" ON "FixedAssetDisposal"("tenantId", "disposalDate");

-- AddForeignKey
ALTER TABLE "FixedAssetDisposal" ADD CONSTRAINT "FixedAssetDisposal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDisposal" ADD CONSTRAINT "FixedAssetDisposal_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetDisposal" ADD CONSTRAINT "FixedAssetDisposal_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
