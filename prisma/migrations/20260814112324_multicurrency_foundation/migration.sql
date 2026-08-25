-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'BND';

-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN     "currencyCode" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(24,12),
ADD COLUMN     "foreignCredit" DECIMAL(19,4),
ADD COLUMN     "foreignDebit" DECIMAL(19,4);

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,
ADD COLUMN     "foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'BND';

-- AlterTable
ALTER TABLE "SupplierBill" ADD COLUMN     "baseTotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "exchangeRate" DECIMAL(24,12) NOT NULL DEFAULT 1,
ADD COLUMN     "foreignTotal" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "baseCurrencyLockedAt" TIMESTAMP(3),
ADD COLUMN     "multiCurrencyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TenantCurrency" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimalPlaces" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantCurrency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "effectiveOn" DATE NOT NULL,
    "rateToBase" DECIMAL(24,12) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantCurrency_tenantId_isActive_idx" ON "TenantCurrency"("tenantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCurrency_tenantId_code_key" ON "TenantCurrency"("tenantId", "code");

-- CreateIndex
CREATE INDEX "ExchangeRate_tenantId_currencyCode_effectiveOn_idx" ON "ExchangeRate"("tenantId", "currencyCode", "effectiveOn");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_tenantId_currencyCode_effectiveOn_key" ON "ExchangeRate"("tenantId", "currencyCode", "effectiveOn");

-- AddForeignKey
ALTER TABLE "TenantCurrency" ADD CONSTRAINT "TenantCurrency_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
