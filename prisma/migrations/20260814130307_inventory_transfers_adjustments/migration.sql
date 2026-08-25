-- CreateEnum
CREATE TYPE "InventoryOperationType" AS ENUM ('TRANSFER', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT');

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'INVENTORY_ADJUSTMENT';

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "operationId" TEXT;

-- CreateTable
CREATE TABLE "InventoryOperation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryOperationType" NOT NULL,
    "reference" TEXT NOT NULL,
    "operationDate" DATE NOT NULL,
    "sourceLocationId" TEXT,
    "destinationLocationId" TEXT,
    "offsetAccountId" TEXT,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,4) NOT NULL,
    "totalCost" DECIMAL(19,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "journalId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_journalId_key" ON "InventoryOperation"("journalId");

-- CreateIndex
CREATE INDEX "InventoryOperation_tenantId_operationDate_idx" ON "InventoryOperation"("tenantId", "operationDate");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryOperation_tenantId_reference_key" ON "InventoryOperation"("tenantId", "reference");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "InventoryOperation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_sourceLocationId_fkey" FOREIGN KEY ("sourceLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_destinationLocationId_fkey" FOREIGN KEY ("destinationLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryOperation" ADD CONSTRAINT "InventoryOperation_offsetAccountId_fkey" FOREIGN KEY ("offsetAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
