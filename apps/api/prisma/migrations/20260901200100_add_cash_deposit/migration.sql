-- AlterTable
ALTER TABLE "day_closings" ADD COLUMN     "cashDeposits" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cash_deposits" (
    "id" TEXT NOT NULL,
    "depositNumber" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transferReference" TEXT NOT NULL,
    "note" TEXT,
    "cashierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_deposit_counters" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cash_deposit_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_deposits_depositNumber_key" ON "cash_deposits"("depositNumber");

-- AddForeignKey
ALTER TABLE "cash_deposits" ADD CONSTRAINT "cash_deposits_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
