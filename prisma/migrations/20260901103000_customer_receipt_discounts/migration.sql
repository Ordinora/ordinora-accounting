ALTER TABLE "CustomerReceipt"
ADD COLUMN "discountForeignAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN "discountBaseAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;

ALTER TABLE "SalesInvoiceAllocation"
ADD COLUMN "discountInput" TEXT,
ADD COLUMN "discountForeignAmount" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN "discountBaseAmount" DECIMAL(19,4) NOT NULL DEFAULT 0;
