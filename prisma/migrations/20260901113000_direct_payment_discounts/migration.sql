ALTER TABLE "Payment"
ADD COLUMN "foreignSubtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN "discountValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

UPDATE "Payment"
SET "foreignSubtotal" = "foreignAmount";
