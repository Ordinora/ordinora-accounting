CREATE TYPE "DocumentWorkflowStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'POSTED', 'REJECTED');

ALTER TABLE "Document"
ADD COLUMN "workflowStatus" "DocumentWorkflowStatus" NOT NULL DEFAULT 'RECEIVED',
ADD COLUMN "workflowReference" TEXT,
ADD COLUMN "workflowNote" TEXT,
ADD COLUMN "workflowUpdatedAt" TIMESTAMP(3),
ADD COLUMN "workflowUpdatedById" TEXT;

CREATE INDEX "Document_tenantId_workflowStatus_createdAt_idx"
ON "Document"("tenantId", "workflowStatus", "createdAt");
