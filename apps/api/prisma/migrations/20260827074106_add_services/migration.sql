-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultFee" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_transaction_counters" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastValue" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_transaction_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_transactions" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "billAmount" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "amountReceived" INTEGER NOT NULL,
    "changeDue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_transactions_transactionNumber_key" ON "service_transactions"("transactionNumber");

-- CreateIndex
CREATE INDEX "service_transactions_serviceId_idx" ON "service_transactions"("serviceId");

-- CreateIndex
CREATE INDEX "service_transactions_cashierId_idx" ON "service_transactions"("cashierId");

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_transactions" ADD CONSTRAINT "service_transactions_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
