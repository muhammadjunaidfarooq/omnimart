-- AlterTable: add as nullable first so existing rows can be backfilled
ALTER TABLE "stock_batches" ADD COLUMN     "costPrice" INTEGER,
ADD COLUMN     "sellingPrice" INTEGER;

-- Backfill existing batches from their parent product's current price —
-- these predate per-batch pricing, so the product's price is the closest
-- available approximation of what that batch actually cost/sold at.
UPDATE "stock_batches" AS sb
SET "costPrice" = p."costPrice",
    "sellingPrice" = p."sellingPrice"
FROM "products" AS p
WHERE sb."productId" = p.id;

-- Now that every row has a value, enforce NOT NULL going forward
ALTER TABLE "stock_batches" ALTER COLUMN "costPrice" SET NOT NULL,
ALTER COLUMN "sellingPrice" SET NOT NULL;
