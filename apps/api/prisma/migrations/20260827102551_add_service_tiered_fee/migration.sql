-- AlterTable
ALTER TABLE "services" ADD COLUMN     "feePerThousand" INTEGER,
ADD COLUMN     "useTieredFee" BOOLEAN NOT NULL DEFAULT false;
