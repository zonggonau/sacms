-- Automatic PostgreSQL + MinIO provisioning status for a VpsInstance (see
-- src/lib/vps-db-storage.ts). pending | connecting | connected | skipped | failed.
ALTER TABLE "vps_instances" ADD COLUMN "dbStorageStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "vps_instances" ADD COLUMN "dbStorageError" TEXT;
ALTER TABLE "vps_instances" ADD COLUMN "dbStorageConnectedAt" TIMESTAMP(3);
