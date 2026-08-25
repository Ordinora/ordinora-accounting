CREATE TYPE "InventoryCostingMethod" AS ENUM ('WEIGHTED_AVERAGE', 'FIFO');

ALTER TABLE "Tenant"
ADD COLUMN "inventoryCostingMethod" "InventoryCostingMethod" NOT NULL DEFAULT 'WEIGHTED_AVERAGE';

CREATE TABLE "InventoryCostLayer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "receivedOn" DATE NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "originalQuantity" DECIMAL(19,4) NOT NULL,
    "remainingQuantity" DECIMAL(19,4) NOT NULL,
    "unitCost" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryCostLayer_tenantId_itemId_locationId_receivedOn_createdAt_idx"
ON "InventoryCostLayer"("tenantId", "itemId", "locationId", "receivedOn", "createdAt");
CREATE INDEX "InventoryCostLayer_tenantId_remainingQuantity_idx"
ON "InventoryCostLayer"("tenantId", "remainingQuantity");

ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_itemId_fkey"
FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
