-- Owner's explicit per-workspace slice of their pooled EnterpriseLicense
-- storage grant. One row per tenant that has been EXPLICITLY assigned a
-- figure; a tenant with no row gets an equal share of the pool's remainder,
-- computed live (see getOwnerStorageAllocationPlan() in plan-enforcement.ts)
-- — this table never stores an "auto" value.

-- CreateTable
CREATE TABLE "enterprise_storage_allocations" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "allocatedGb" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enterprise_storage_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enterprise_storage_allocations_tenantId_key" ON "enterprise_storage_allocations"("tenantId");

-- CreateIndex
CREATE INDEX "enterprise_storage_allocations_ownerId_idx" ON "enterprise_storage_allocations"("ownerId");

-- AddForeignKey
ALTER TABLE "enterprise_storage_allocations" ADD CONSTRAINT "enterprise_storage_allocations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
