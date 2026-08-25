CREATE TABLE "ReferenceSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReferenceSequence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferenceSequence_tenantId_key_year_key" ON "ReferenceSequence"("tenantId", "key", "year");
CREATE INDEX "ReferenceSequence_tenantId_idx" ON "ReferenceSequence"("tenantId");
ALTER TABLE "ReferenceSequence" ADD CONSTRAINT "ReferenceSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
