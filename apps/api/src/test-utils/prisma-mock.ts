/**
 * A lightweight jest.fn()-based stand-in for PrismaService/Prisma.TransactionClient,
 * covering only the delegate methods the services under test actually call.
 * `$transaction` invokes its callback with the same mock object (mirroring how a
 * real transaction client exposes the same delegate shape as PrismaService),
 * so tests can set expectations on `tx` methods directly.
 */
export function createMockPrisma() {
  const tx = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    businessSettings: {
      findUniqueOrThrow: jest.fn(),
    },
    sale: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    saleItem: {
      create: jest.fn(),
      deleteMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    saleItemBatch: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
    borrower: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stockBatch: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    stockMovement: {
      create: jest.fn(),
    },
    khataPayment: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const prisma = {
    ...tx,
    $transaction: jest.fn((arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: typeof prisma) => unknown)(prisma);
      }
      return Promise.all(arg as unknown[]);
    }),
  };

  return prisma;
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;
