ALTER TABLE "PaymentLine" ADD COLUMN "inventoryItemId" TEXT;
ALTER TABLE "PaymentLine" ADD COLUMN "inventoryLocationId" TEXT;
CREATE INDEX "PaymentLine_inventoryItemId_idx" ON "PaymentLine"("inventoryItemId");
CREATE INDEX "PaymentLine_inventoryLocationId_idx" ON "PaymentLine"("inventoryLocationId");
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
