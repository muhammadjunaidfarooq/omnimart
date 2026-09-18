-- AlterTable
ALTER TABLE "khata_payments" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "transferReference" TEXT;
