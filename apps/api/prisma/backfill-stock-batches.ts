/**
 * One-off backfill for the stock-batch/expiry feature. Run once, after the
 * `add_stock_batches_expiry` migration, against any database that has
 * pre-existing `Product.currentStock` with no corresponding `StockBatch` yet.
 *
 * For every product with currentStock > 0, creates a single legacy batch
 * with no expiry date so FEFO consumption has something to draw from.
 * Products with currentStock === 0 are skipped (nothing to backfill).
 *
 * Usage: npx ts-node prisma/backfill-stock-batches.ts
 */
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) {
    throw new Error(
      'No ADMIN user found — cannot attribute backfilled stock batches',
    );
  }

  const products = await prisma.product.findMany({
    where: { currentStock: { gt: 0 } },
    select: {
      id: true,
      name: true,
      currentStock: true,
      costPrice: true,
      sellingPrice: true,
    },
  });

  if (products.length === 0) {
    console.log('No products with existing stock — nothing to backfill.');
    return;
  }

  for (const product of products) {
    const existing = await prisma.stockBatch.count({
      where: { productId: product.id },
    });
    if (existing > 0) {
      console.log(`Skipping "${product.name}" — already has batches.`);
      continue;
    }

    await prisma.stockBatch.create({
      data: {
        productId: product.id,
        quantity: product.currentStock,
        remainingQuantity: product.currentStock,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        expiryDate: null,
        reason: 'Migrated existing stock (no expiry recorded)',
        createdById: admin.id,
      },
    });
    console.log(
      `Backfilled "${product.name}": ${product.currentStock} units, no expiry.`,
    );
  }

  console.log(`Done — backfilled ${products.length} product(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
