ALTER TABLE "FixedAsset"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceLineId" TEXT,
ADD COLUMN "sourceReference" TEXT;

CREATE UNIQUE INDEX "FixedAsset_tenantId_sourceLineId_key"
ON "FixedAsset"("tenantId", "sourceLineId");
