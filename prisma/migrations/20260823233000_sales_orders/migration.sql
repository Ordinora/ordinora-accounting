CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'READY_TO_INVOICE', 'CONVERTED', 'CANCELLED');

CREATE TABLE "SalesOrder" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "quotationId" TEXT,
  "reference" TEXT NOT NULL, "orderDate" DATE NOT NULL, "expectedDate" DATE, "description" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'BND', "exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,
  "foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0, "baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT', "createdById" TEXT NOT NULL,
  "confirmedAt" TIMESTAMP(3), "readyAt" TIMESTAMP(3), "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesOrderLine" (
  "id" TEXT NOT NULL, "salesOrderId" TEXT NOT NULL, "revenueAccountId" TEXT NOT NULL,
  "inventoryItemId" TEXT, "inventoryLocationId" TEXT, "description" TEXT NOT NULL,
  "quantity" DECIMAL(19,4) NOT NULL, "unitPrice" DECIMAL(19,4) NOT NULL,
  "discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0, "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "lineTotal" DECIMAL(19,4) NOT NULL, CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalesInvoice" ADD COLUMN "salesOrderId" TEXT;
CREATE UNIQUE INDEX "SalesOrder_quotationId_key" ON "SalesOrder"("quotationId");
CREATE UNIQUE INDEX "SalesOrder_tenantId_reference_key" ON "SalesOrder"("tenantId", "reference");
CREATE INDEX "SalesOrder_tenantId_status_expectedDate_idx" ON "SalesOrder"("tenantId", "status", "expectedDate");
CREATE INDEX "SalesOrder_tenantId_orderDate_idx" ON "SalesOrder"("tenantId", "orderDate");
CREATE UNIQUE INDEX "SalesInvoice_salesOrderId_key" ON "SalesInvoice"("salesOrderId");

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
