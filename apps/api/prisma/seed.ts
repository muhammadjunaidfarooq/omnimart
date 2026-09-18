import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function upsertUser(
  name: string,
  email: string,
  password: string,
  role: Role,
) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash, role },
  });
}

async function upsertCategory(name: string) {
  return prisma.category.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function upsertBrand(name: string) {
  return prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
}

async function upsertUnit(
  name: string,
  abbreviation: string,
  allowsFractionalQuantity = false,
) {
  return prisma.unit.upsert({
    where: { name },
    update: { allowsFractionalQuantity },
    create: { name, abbreviation, allowsFractionalQuantity },
  });
}

async function main() {
  const admin = await upsertUser(
    'Admin',
    'admin@omnimart.local',
    'Admin@123',
    Role.ADMIN,
  );
  const cashier = await upsertUser(
    'Cashier',
    'cashier@omnimart.local',
    'Cashier@123',
    Role.CASHIER,
  );

  console.log('Seeded users:');
  console.log(`  ADMIN   -> ${admin.email} / Admin@123`);
  console.log(`  CASHIER -> ${cashier.email} / Cashier@123`);

  const categories = await Promise.all(
    ['Beverages', 'Snacks', 'Household', 'Personal Care', 'Stationery'].map(
      upsertCategory,
    ),
  );
  const brands = await Promise.all(
    ['Generic', 'Local Choice', 'Premium Select'].map(upsertBrand),
  );
  const units = await Promise.all([
    upsertUnit('Piece', 'pc'),
    upsertUnit('Kilogram', 'kg', true),
    upsertUnit('Litre', 'L', true),
    upsertUnit('Box', 'box'),
    upsertUnit('Pack', 'pack'),
  ]);

  console.log('Seeded catalog lookups:');
  console.log(`  Categories -> ${categories.map((c) => c.name).join(', ')}`);
  console.log(`  Brands     -> ${brands.map((b) => b.name).join(', ')}`);
  console.log(`  Units      -> ${units.map((u) => u.name).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
