-- Every service_transactions row that predates this migration was recorded
-- before Cash Withdrawal/Deposit existed, so it's safe to backfill all of
-- them as BILL_PAYMENT. Adding the column with a default (rather than bare
-- NOT NULL) backfills existing rows instead of failing outright on a
-- non-empty table (this app has been live with real bill-payment
-- transactions since before this migration was written). The default is
-- dropped immediately after, matching the Prisma schema (no @default on
-- this field) — every future insert must specify direction explicitly.
ALTER TABLE "service_transactions" ADD COLUMN "direction" "ServiceDirection" NOT NULL DEFAULT 'BILL_PAYMENT';
ALTER TABLE "service_transactions" ALTER COLUMN "direction" DROP DEFAULT;
