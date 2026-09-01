CREATE TABLE "OpeningPayrollYtd" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "basicPay" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "bonuses" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "leavePayout" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "gratuity" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "otherEarnings" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "employeeSpk" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "employerSpk" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(19,4) NOT NULL,
    "netPay" DECIMAL(19,4) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningPayrollYtd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpeningPayrollYtd_employeeId_key" ON "OpeningPayrollYtd"("employeeId");
CREATE INDEX "OpeningPayrollYtd_tenantId_asOfDate_idx" ON "OpeningPayrollYtd"("tenantId", "asOfDate");

ALTER TABLE "OpeningPayrollYtd" ADD CONSTRAINT "OpeningPayrollYtd_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OpeningPayrollYtd" ADD CONSTRAINT "OpeningPayrollYtd_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpeningPayrollYtd" ADD CONSTRAINT "OpeningPayrollYtd_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
