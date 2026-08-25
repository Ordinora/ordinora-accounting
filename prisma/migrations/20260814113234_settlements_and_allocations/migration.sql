-- CreateTable
CREATE TABLE "CustomerReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "receiptDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(24,12) NOT NULL,
    "foreignAmount" DECIMAL(19,4) NOT NULL,
    "baseAmount" DECIMAL(19,4) NOT NULL,
    "realizedFxBase" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesInvoiceAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "foreignAmount" DECIMAL(19,4) NOT NULL,
    "carryingBaseAmount" DECIMAL(19,4) NOT NULL,
    "settlementBaseAmount" DECIMAL(19,4) NOT NULL,
    "realizedFxBase" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "SalesInvoiceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" DECIMAL(24,12) NOT NULL,
    "foreignAmount" DECIMAL(19,4) NOT NULL,
    "baseAmount" DECIMAL(19,4) NOT NULL,
    "realizedFxBase" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "journalId" TEXT,
    "createdById" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierBillAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "foreignAmount" DECIMAL(19,4) NOT NULL,
    "carryingBaseAmount" DECIMAL(19,4) NOT NULL,
    "settlementBaseAmount" DECIMAL(19,4) NOT NULL,
    "realizedFxBase" DECIMAL(19,4) NOT NULL,

    CONSTRAINT "SupplierBillAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_journalId_key" ON "CustomerReceipt"("journalId");

-- CreateIndex
CREATE INDEX "CustomerReceipt_tenantId_receiptDate_idx" ON "CustomerReceipt"("tenantId", "receiptDate");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerReceipt_tenantId_reference_key" ON "CustomerReceipt"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "SalesInvoiceAllocation_invoiceId_idx" ON "SalesInvoiceAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceAllocation_receiptId_invoiceId_key" ON "SalesInvoiceAllocation"("receiptId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_journalId_key" ON "SupplierPayment"("journalId");

-- CreateIndex
CREATE INDEX "SupplierPayment_tenantId_paymentDate_idx" ON "SupplierPayment"("tenantId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_tenantId_reference_key" ON "SupplierPayment"("tenantId", "reference");

-- CreateIndex
CREATE INDEX "SupplierBillAllocation_billId_idx" ON "SupplierBillAllocation"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierBillAllocation_paymentId_billId_key" ON "SupplierBillAllocation"("paymentId", "billId");

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerReceipt" ADD CONSTRAINT "CustomerReceipt_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceAllocation" ADD CONSTRAINT "SalesInvoiceAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "CustomerReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceAllocation" ADD CONSTRAINT "SalesInvoiceAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillAllocation" ADD CONSTRAINT "SupplierBillAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "SupplierPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBillAllocation" ADD CONSTRAINT "SupplierBillAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "SupplierBill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
