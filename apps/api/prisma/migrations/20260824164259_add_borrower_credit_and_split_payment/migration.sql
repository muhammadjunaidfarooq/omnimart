-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'SPLIT';

-- AlterTable
ALTER TABLE "borrowers" ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0;
