-- CreateTable
CREATE TABLE "cash_withdrawals" (
    "id" TEXT NOT NULL,
    "withdrawalNumber" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transferReference" TEXT NOT NULL,
    "note" TEXT,
    "cashierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_withdrawal_counters" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cash_withdrawal_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_withdrawals_withdrawalNumber_key" ON "cash_withdrawals"("withdrawalNumber");

-- AddForeignKey
ALTER TABLE "cash_withdrawals" ADD CONSTRAINT "cash_withdrawals_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the withdrawal-number counter singleton row, same as every other counter table
INSERT INTO "cash_withdrawal_counters" ("id", "lastValue") VALUES (1, 0);

-- Rework day_closings: rename the two fields that keep the same meaning,
-- add the new breakdown columns, backfill existing rows, then require them.

-- RenameColumn (same meaning as before: cash on hand from sales, pre-inventory-deduction)
ALTER TABLE "day_closings" RENAME COLUMN "cashCollected" TO "cashFromSales";

-- AddColumn
ALTER TABLE "day_closings" ADD COLUMN "cashWithdrawals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "day_closings" ADD COLUMN "expenses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "day_closings" ADD COLUMN "cashRemainingFromSales" INTEGER;
ALTER TABLE "day_closings" ADD COLUMN "netCashInHand" INTEGER;

-- Backfill existing rows: no historical per-day expense/withdrawal breakdown
-- was captured before this migration, so cashRemainingFromSales/netCashInHand
-- are approximated from the old single "remainingCashBalance" figure (which
-- was already cashFromSales - cashUsedForInventory) — accurate for rows
-- closed with $0 expenses/withdrawals recorded that day, an approximation
-- otherwise. This feature shipped hours before this migration, so the
-- affected row count is expected to be negligible.
UPDATE "day_closings" SET
  "cashRemainingFromSales" = "remainingCashBalance",
  "netCashInHand" = "remainingCashBalance";

-- Now that every row has a value, make the derived columns required
ALTER TABLE "day_closings" ALTER COLUMN "cashRemainingFromSales" SET NOT NULL;
ALTER TABLE "day_closings" ALTER COLUMN "netCashInHand" SET NOT NULL;

-- DropColumn
ALTER TABLE "day_closings" DROP COLUMN "remainingCashBalance";
