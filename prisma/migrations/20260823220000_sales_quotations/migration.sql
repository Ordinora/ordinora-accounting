CREATE TYPE "SalesQuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED', 'CANCELLED');

CREATE TABLE "SalesQuotation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "quoteDate" DATE NOT NULL,
    "validUntil" DATE NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'BND',
    "exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,
    "foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "status" "SalesQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SalesQuotation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesQuotationLine" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "revenueAccountId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "inventoryLocationId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "discountPercent" DECIMAL(9,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(19,4) NOT NULL,
    CONSTRAINT "SalesQuotationLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalesInvoice" ADD COLUMN "quotationId" TEXT;
CREATE UNIQUE INDEX "SalesQuotation_tenantId_reference_key" ON "SalesQuotation"("tenantId", "reference");
CREATE INDEX "SalesQuotation_tenantId_status_validUntil_idx" ON "SalesQuotation"("tenantId", "status", "validUntil");
CREATE INDEX "SalesQuotation_tenantId_quoteDate_idx" ON "SalesQuotation"("tenantId", "quoteDate");
CREATE UNIQUE INDEX "SalesInvoice_quotationId_key" ON "SalesInvoice"("quotationId");

ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuotation" ADD CONSTRAINT "SalesQuotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesQuotationLine" ADD CONSTRAINT "SalesQuotationLine_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "SalesQuotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
