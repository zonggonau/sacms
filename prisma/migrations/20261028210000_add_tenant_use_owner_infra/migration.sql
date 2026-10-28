-- Per-workspace switch deciding whether this tenant inherits its owner's
-- "Infrastruktur Sendiri" (BYODB/BYOS) or stays on SaCMS's own dedicated
-- DB / Enterprise storage pool — see getOwnerMasterInfra() in
-- src/lib/database.ts. Defaults to true so existing behavior (automatic
-- inheritance) is unchanged for every current tenant.

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "useOwnerInfra" BOOLEAN NOT NULL DEFAULT true;
