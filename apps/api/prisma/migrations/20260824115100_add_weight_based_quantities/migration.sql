-- AlterTable
ALTER TABLE "products" ALTER COLUMN "minimumStockLevel" SET DEFAULT 0,
ALTER COLUMN "minimumStockLevel" SET DATA TYPE DECIMAL(10,3),
ALTER COLUMN "currentStock" SET DEFAULT 0,
ALTER COLUMN "currentStock" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "refund_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "sale_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(10,3);

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "allowsFractionalQuantity" BOOLEAN NOT NULL DEFAULT false;
