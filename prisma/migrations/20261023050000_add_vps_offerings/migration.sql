-- Purchasable VPS catalog (admin-curated, maps to a Biznet Gio NEO Lite
-- product + OS image) and the resulting purchased/provisioned instances,
-- scoped either to an account (tenantId null) or to one workspace.

-- CreateTable
CREATE TABLE "vps_offerings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "biznetProductId" TEXT NOT NULL,
    "biznetOsImageId" TEXT NOT NULL,
    "osLabel" TEXT NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "memoryMb" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "priceMonthlyIdr" DOUBLE PRECISION NOT NULL,
    "priceAnnualIdr" DOUBLE PRECISION,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vps_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vps_instances" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'provisioning',
    "billingCycle" TEXT NOT NULL,
    "biznetAccountId" TEXT,
    "biznetKeypairId" TEXT,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "rootUser" TEXT,
    "rootPassword" TEXT,
    "failureReason" TEXT,
    "nextDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vps_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vps_offerings_slug_key" ON "vps_offerings"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "vps_instances_orderId_key" ON "vps_instances"("orderId");

-- CreateIndex
CREATE INDEX "vps_instances_ownerId_idx" ON "vps_instances"("ownerId");

-- CreateIndex
CREATE INDEX "vps_instances_tenantId_idx" ON "vps_instances"("tenantId");

-- AddForeignKey
ALTER TABLE "vps_instances" ADD CONSTRAINT "vps_instances_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "vps_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vps_instances" ADD CONSTRAINT "vps_instances_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
