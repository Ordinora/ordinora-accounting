-- CreateEnum
CREATE TYPE "CapitalAllowanceItemStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'EXCLUDED');

-- CreateTable
CREATE TABLE "CapitalAllowanceItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxYearId" TEXT NOT NULL,
    "assetCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquiredOn" DATE,
    "originalCost" DECIMAL(19,4) NOT NULL,
    "qualifyingAddition" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "taxWrittenDownValueBf" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "disposalDeduction" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "initialAllowanceRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "annualAllowanceRate" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "privateUsePercent" DECIMAL(7,4) NOT NULL DEFAULT 0,
    "status" "CapitalAllowanceItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalAllowanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapitalAllowanceItem_tenantId_taxYearId_status_idx" ON "CapitalAllowanceItem"("tenantId", "taxYearId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalAllowanceItem_tenantId_taxYearId_assetCode_key" ON "CapitalAllowanceItem"("tenantId", "taxYearId", "assetCode");

-- AddForeignKey
ALTER TABLE "CapitalAllowanceItem" ADD CONSTRAINT "CapitalAllowanceItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalAllowanceItem" ADD CONSTRAINT "CapitalAllowanceItem_taxYearId_fkey" FOREIGN KEY ("taxYearId") REFERENCES "TaxYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
