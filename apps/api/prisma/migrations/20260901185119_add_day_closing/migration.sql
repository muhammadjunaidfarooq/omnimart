-- CreateTable
CREATE TABLE "day_closings" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalSales" INTEGER NOT NULL,
    "cashCollected" INTEGER NOT NULL,
    "cashUsedForInventory" INTEGER NOT NULL DEFAULT 0,
    "remainingCashBalance" INTEGER NOT NULL,
    "note" TEXT,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "day_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "day_closings_date_key" ON "day_closings"("date");

-- AddForeignKey
ALTER TABLE "day_closings" ADD CONSTRAINT "day_closings_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
