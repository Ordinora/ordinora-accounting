-- AlterEnum
ALTER TYPE "JournalSource" ADD VALUE 'PAYROLL_PAYMENT';

-- CreateTable
CREATE TABLE "PayrollSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "journalId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettlement_journalId_key" ON "PayrollSettlement"("journalId");

-- CreateIndex
CREATE INDEX "PayrollSettlement_payrollRunId_paymentDate_idx" ON "PayrollSettlement"("payrollRunId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettlement_tenantId_reference_key" ON "PayrollSettlement"("tenantId", "reference");

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettlement" ADD CONSTRAINT "PayrollSettlement_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
