ALTER TABLE "CustomerReceipt" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "CustomerReceipt" ADD COLUMN "payerType" TEXT NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "CustomerReceipt" ADD COLUMN "payerName" TEXT;
ALTER TABLE "CustomerReceipt" ADD COLUMN "description" TEXT;

CREATE TABLE "CustomerReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(19,4) NOT NULL,
    "unitPrice" DECIMAL(19,4) NOT NULL,
    "foreignAmount" DECIMAL(19,4) NOT NULL,
    "baseAmount" DECIMAL(19,4) NOT NULL,
    CONSTRAINT "CustomerReceiptLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerReceiptLine_receiptId_idx" ON "CustomerReceiptLine"("receiptId");
CREATE INDEX "CustomerReceiptLine_accountId_idx" ON "CustomerReceiptLine"("accountId");

ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerReceiptLine" ADD CONSTRAINT "CustomerReceiptLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
