-- AlterTable
ALTER TABLE "service_transactions" ADD COLUMN     "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "transferReference" TEXT;
