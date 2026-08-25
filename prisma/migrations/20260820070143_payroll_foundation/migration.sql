-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('MONTHLY', 'HOURLY');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'LOCKED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "identityReference" TEXT,
    "citizenship" TEXT NOT NULL,
    "identityCardCategory" TEXT,
    "schemeEligible" BOOLEAN NOT NULL DEFAULT true,
    "payFrequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "basicSalary" DECIMAL(19,4) NOT NULL,
    "hourlyRate" DECIMAL(19,4),
    "department" TEXT,
    "employmentStart" DATE NOT NULL,
    "employmentEnd" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpkRateBand" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "salaryFrom" DECIMAL(19,4) NOT NULL,
    "salaryTo" DECIMAL(19,4),
    "employeeRatePercent" DECIMAL(7,4) NOT NULL,
    "employerRatePercent" DECIMAL(7,4),
    "employerFixedAmount" DECIMAL(19,4),
    "minimumEmployerAmount" DECIMAL(19,4),
    "isDemonstration" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpkRateBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "payDate" DATE NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEntry" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "basicPay" DECIMAL(19,4) NOT NULL,
    "overtime" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "bonuses" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "employeeSpk" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "employerSpk" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(19,4) NOT NULL,
    "netPay" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "PayrollEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Employee_tenantId_status_fullName_idx" ON "Employee"("tenantId", "status", "fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_tenantId_employeeNumber_key" ON "Employee"("tenantId", "employeeNumber");

-- CreateIndex
CREATE INDEX "SpkRateBand_tenantId_effectiveFrom_effectiveTo_idx" ON "SpkRateBand"("tenantId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "SpkRateBand_tenantId_name_effectiveFrom_key" ON "SpkRateBand"("tenantId", "name", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_journalId_key" ON "PayrollRun"("journalId");

-- CreateIndex
CREATE INDEX "PayrollRun_tenantId_payDate_status_idx" ON "PayrollRun"("tenantId", "payDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_reference_key" ON "PayrollRun"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "PayrollEntry_employeeId_idx" ON "PayrollEntry"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEntry_payrollRunId_employeeId_key" ON "PayrollEntry"("payrollRunId", "employeeId");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpkRateBand" ADD CONSTRAINT "SpkRateBand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEntry" ADD CONSTRAINT "PayrollEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
