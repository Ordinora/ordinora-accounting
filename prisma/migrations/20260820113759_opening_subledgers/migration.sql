-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN     "isOpeningBalance" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupplierBill" ADD COLUMN     "isOpeningBalance" BOOLEAN NOT NULL DEFAULT false;
