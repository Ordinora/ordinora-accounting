-- CreateEnum
CREATE TYPE "PayrollRunType" AS ENUM ('REGULAR', 'FINAL_PAY');

-- AlterTable
ALTER TABLE "PayrollEntry" ADD COLUMN     "gratuity" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "leavePayout" DECIMAL(19,4) NOT NULL DEFAULT 0,
ADD COLUMN     "otherEarnings" DECIMAL(19,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollRun" ADD COLUMN     "runType" "PayrollRunType" NOT NULL DEFAULT 'REGULAR';
