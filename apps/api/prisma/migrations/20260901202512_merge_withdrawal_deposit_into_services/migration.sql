-- Cash Withdrawal/Deposit are merged into the Service/ServiceTransaction
-- model (as a "direction" on Service) instead of being their own tables.
-- Both cash_withdrawals/cash_deposits (and their counters) are empty at
-- migration time — nothing to migrate.

-- DropForeignKey
ALTER TABLE "cash_withdrawals" DROP CONSTRAINT "cash_withdrawals_cashierId_fkey";
ALTER TABLE "cash_deposits" DROP CONSTRAINT "cash_deposits_cashierId_fkey";

-- DropTable
DROP TABLE "cash_withdrawals";
DROP TABLE "cash_withdrawal_counters";
DROP TABLE "cash_deposits";
DROP TABLE "cash_deposit_counters";

-- CreateEnum
CREATE TYPE "ServiceDirection" AS ENUM ('BILL_PAYMENT', 'CASH_WITHDRAWAL', 'CASH_DEPOSIT');

-- AlterTable
ALTER TABLE "services" ADD COLUMN "direction" "ServiceDirection" NOT NULL DEFAULT 'BILL_PAYMENT';

-- AlterTable
ALTER TABLE "service_transactions" ADD COLUMN "note" TEXT;
