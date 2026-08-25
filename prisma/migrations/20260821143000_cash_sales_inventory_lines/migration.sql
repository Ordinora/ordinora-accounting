ALTER TABLE "DailyCashSaleLine" ADD COLUMN "inventoryItemId" TEXT;
ALTER TABLE "DailyCashSaleLine" ADD COLUMN "inventoryLocationId" TEXT;
CREATE INDEX "DailyCashSaleLine_inventoryItemId_idx" ON "DailyCashSaleLine"("inventoryItemId");
CREATE INDEX "DailyCashSaleLine_inventoryLocationId_idx" ON "DailyCashSaleLine"("inventoryLocationId");
ALTER TABLE "DailyCashSaleLine" ADD CONSTRAINT "DailyCashSaleLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DailyCashSaleLine" ADD CONSTRAINT "DailyCashSaleLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
