CREATE TYPE "SupplierQuotationStatus" AS ENUM ('RECEIVED','SELECTED','REJECTED','EXPIRED','CONVERTED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','APPROVED','PARTIALLY_RECEIVED','RECEIVED','PARTIALLY_BILLED','BILLED','CANCELLED');

CREATE TABLE "SupplierQuotation" (
 "id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"supplierId" TEXT NOT NULL,"reference" TEXT NOT NULL,"comparisonReference" TEXT NOT NULL,
 "quoteDate" DATE NOT NULL,"validUntil" DATE,"description" TEXT,"currency" TEXT NOT NULL DEFAULT 'BND',"exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,
 "foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,"baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,"status" "SupplierQuotationStatus" NOT NULL DEFAULT 'RECEIVED',
 "createdById" TEXT NOT NULL,"selectedAt" TIMESTAMP(3),"convertedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SupplierQuotation_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SupplierQuotationLine" (
 "id" TEXT NOT NULL,"quotationId" TEXT NOT NULL,"expenseAccountId" TEXT NOT NULL,"inventoryItemId" TEXT,"inventoryLocationId" TEXT,
 "description" TEXT NOT NULL,"quantity" DECIMAL(19,4) NOT NULL,"unitPrice" DECIMAL(19,4) NOT NULL,"discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
 "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,"lineTotal" DECIMAL(19,4) NOT NULL,CONSTRAINT "SupplierQuotationLine_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrder" (
 "id" TEXT NOT NULL,"tenantId" TEXT NOT NULL,"supplierId" TEXT NOT NULL,"quotationId" TEXT,"reference" TEXT NOT NULL,"orderDate" DATE NOT NULL,"expectedDate" DATE,
 "description" TEXT,"currency" TEXT NOT NULL DEFAULT 'BND',"exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,"foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
 "baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,"status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',"createdById" TEXT NOT NULL,"approvedAt" TIMESTAMP(3),
 "receivedAt" TIMESTAMP(3),"billedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PurchaseOrderLine" (
 "id" TEXT NOT NULL,"purchaseOrderId" TEXT NOT NULL,"expenseAccountId" TEXT NOT NULL,"inventoryItemId" TEXT,"inventoryLocationId" TEXT,"description" TEXT NOT NULL,
 "quantity" DECIMAL(19,4) NOT NULL,"receivedQuantity" DECIMAL(19,4) NOT NULL DEFAULT 0,"billedQuantity" DECIMAL(19,4) NOT NULL DEFAULT 0,"unitPrice" DECIMAL(19,4) NOT NULL,
 "discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,"discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,"lineTotal" DECIMAL(19,4) NOT NULL,
 CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SupplierBill" ADD COLUMN "purchaseOrderId" TEXT;
CREATE UNIQUE INDEX "SupplierQuotation_tenantId_reference_key" ON "SupplierQuotation"("tenantId","reference");
CREATE INDEX "SupplierQuotation_tenantId_comparisonReference_status_idx" ON "SupplierQuotation"("tenantId","comparisonReference","status");
CREATE INDEX "SupplierQuotation_tenantId_quoteDate_idx" ON "SupplierQuotation"("tenantId","quoteDate");
CREATE UNIQUE INDEX "PurchaseOrder_quotationId_key" ON "PurchaseOrder"("quotationId");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_reference_key" ON "PurchaseOrder"("tenantId","reference");
CREATE INDEX "PurchaseOrder_tenantId_status_expectedDate_idx" ON "PurchaseOrder"("tenantId","status","expectedDate");
CREATE INDEX "PurchaseOrder_tenantId_orderDate_idx" ON "PurchaseOrder"("tenantId","orderDate");
CREATE INDEX "SupplierBill_purchaseOrderId_idx" ON "SupplierBill"("purchaseOrderId");
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotation" ADD CONSTRAINT "SupplierQuotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierQuotationLine" ADD CONSTRAINT "SupplierQuotationLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SupplierQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierBill" ADD CONSTRAINT "SupplierBill_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
