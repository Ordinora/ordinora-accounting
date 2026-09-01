ALTER TABLE "SalesInvoice"
  ADD COLUMN "foreignSubtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "discountValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "SupplierBill"
  ADD COLUMN "foreignSubtotal" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountType" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "discountValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- Existing documents had no document-level discount, so their subtotal equals their total.
UPDATE "SalesInvoice" SET "foreignSubtotal" = "foreignTotal";
UPDATE "SupplierBill" SET "foreignSubtotal" = "foreignTotal";
