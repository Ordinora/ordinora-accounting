CREATE INDEX "SalesInvoice_tenantId_invoiceDate_status_idx"
ON "SalesInvoice"("tenantId", "invoiceDate", "status");

CREATE INDEX "SupplierBill_tenantId_billDate_status_idx"
ON "SupplierBill"("tenantId", "billDate", "status");

CREATE INDEX "InventoryMovement_tenantId_itemId_movementDate_idx"
ON "InventoryMovement"("tenantId", "itemId", "movementDate");
