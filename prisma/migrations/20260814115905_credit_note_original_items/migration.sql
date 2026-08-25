-- AlterTable
ALTER TABLE "SalesCreditNoteLine" ADD COLUMN     "originalInvoiceLineId" TEXT;

-- AlterTable
ALTER TABLE "SupplierCreditNoteLine" ADD COLUMN     "originalBillLineId" TEXT;

-- CreateIndex
CREATE INDEX "SalesCreditNoteLine_originalInvoiceLineId_idx" ON "SalesCreditNoteLine"("originalInvoiceLineId");

-- CreateIndex
CREATE INDEX "SupplierCreditNoteLine_originalBillLineId_idx" ON "SupplierCreditNoteLine"("originalBillLineId");

-- AddForeignKey
ALTER TABLE "SalesCreditNoteLine" ADD CONSTRAINT "SalesCreditNoteLine_originalInvoiceLineId_fkey" FOREIGN KEY ("originalInvoiceLineId") REFERENCES "SalesInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierCreditNoteLine" ADD CONSTRAINT "SupplierCreditNoteLine_originalBillLineId_fkey" FOREIGN KEY ("originalBillLineId") REFERENCES "SupplierBillLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
