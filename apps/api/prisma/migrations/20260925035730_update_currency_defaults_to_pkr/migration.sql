-- AlterTable
ALTER TABLE "business_settings" ALTER COLUMN "currencyCode" SET DEFAULT 'PKR',
ALTER COLUMN "currencySymbol" SET DEFAULT 'Rs ';

-- The column default above only applies to future inserts — the existing
-- singleton row was already created (by the seed_business_settings
-- migration) with the old USD/$ defaults, so it needs updating directly.
UPDATE "business_settings" SET "currencyCode" = 'PKR', "currencySymbol" = 'Rs ' WHERE id = 1;
