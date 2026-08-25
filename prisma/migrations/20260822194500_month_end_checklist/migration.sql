CREATE TABLE "MonthEndChecklistItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedById" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthEndChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonthEndChecklistItem_periodId_key_key" ON "MonthEndChecklistItem"("periodId", "key");
CREATE INDEX "MonthEndChecklistItem_tenantId_periodId_idx" ON "MonthEndChecklistItem"("tenantId", "periodId");

ALTER TABLE "MonthEndChecklistItem" ADD CONSTRAINT "MonthEndChecklistItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthEndChecklistItem" ADD CONSTRAINT "MonthEndChecklistItem_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonthEndChecklistItem" ADD CONSTRAINT "MonthEndChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
