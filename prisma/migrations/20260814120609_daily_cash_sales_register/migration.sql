-- CreateEnum
CREATE TYPE "TenderType" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'OTHER');

-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'DAILY_CASH_SALES';

-- CreateTable
CREATE TABLE "DailyCashRegister" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "registerDate" DATE NOT NULL,
    "branchLabel" TEXT,
    "registerLabel" TEXT,
    "currency" TEXT NOT NULL,
    "openingFloat" DECIMAL(19,4) NOT NULL,
    "salesTotal" DECIMAL(19,4) NOT NULL,
    "cashTenderTotal" DECIMAL(19,4) NOT NULL,
    "expectedClosingCash" DECIMAL(19,4) NOT NULL,
    "actualClosingCash" DECIMAL(19,4) NOT NULL,
    "cashVariance" DECIMAL(19,4) NOT NULL,
    "journalId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyCashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCashSaleLine" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "revenueAccountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "lineTotal" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "DailyCashSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCashTender" (
    "id" TEXT NOT NULL,
    "registerId" TEXT NOT NULL,
    "type" "TenderType" NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" TEXT,

    CONSTRAINT "DailyCashTender_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashRegister_journalId_key" ON "DailyCashRegister"("journalId");

-- CreateIndex
CREATE INDEX "DailyCashRegister_tenantId_registerDate_idx" ON "DailyCashRegister"("tenantId", "registerDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCashRegister_tenantId_reference_key" ON "DailyCashRegister"("tenantId", "reference");

-- AddForeignKey
ALTER TABLE "DailyCashRegister" ADD CONSTRAINT "DailyCashRegister_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashRegister" ADD CONSTRAINT "DailyCashRegister_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashRegister" ADD CONSTRAINT "DailyCashRegister_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashSaleLine" ADD CONSTRAINT "DailyCashSaleLine_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "DailyCashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashSaleLine" ADD CONSTRAINT "DailyCashSaleLine_revenueAccountId_fkey" FOREIGN KEY ("revenueAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashTender" ADD CONSTRAINT "DailyCashTender_registerId_fkey" FOREIGN KEY ("registerId") REFERENCES "DailyCashRegister"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCashTender" ADD CONSTRAINT "DailyCashTender_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
