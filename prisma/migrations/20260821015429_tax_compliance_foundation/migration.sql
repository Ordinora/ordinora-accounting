-- CreateEnum
CREATE TYPE "TaxWorkingStatus" AS ENUM ('DRAFT', 'PREPARING', 'READY_TO_FILE', 'FILED', 'OVERDUE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "ComplianceTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'DISMISSED');

-- CreateTable
CREATE TABLE "TaxYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "filingDueOn" DATE,
    "status" "TaxWorkingStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "filedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "status" "ComplianceTaskStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxYear_tenantId_status_filingDueOn_idx" ON "TaxYear"("tenantId", "status", "filingDueOn");

-- CreateIndex
CREATE UNIQUE INDEX "TaxYear_tenantId_year_key" ON "TaxYear"("tenantId", "year");

-- CreateIndex
CREATE INDEX "ComplianceTask_tenantId_status_dueOn_idx" ON "ComplianceTask"("tenantId", "status", "dueOn");

-- AddForeignKey
ALTER TABLE "TaxYear" ADD CONSTRAINT "TaxYear_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceTask" ADD CONSTRAINT "ComplianceTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
