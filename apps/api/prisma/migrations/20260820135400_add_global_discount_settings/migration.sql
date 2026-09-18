-- AlterTable
ALTER TABLE "business_settings" ADD COLUMN     "globalDiscountEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "globalDiscountType" "DiscountType",
ADD COLUMN     "globalDiscountValue" INTEGER;
