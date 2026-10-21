-- Soft-delete / trash support for ContentEntry.
--
-- "Hapus Entri" used to call `contentEntry.delete` (a real, unrecoverable
-- row delete). This adds a nullable `deletedAt` timestamp so delete can
-- become a soft-delete with a restore window instead; a separate cron job
-- purges rows whose deletedAt is old enough.

-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "content_entries_tenantId_contentTypeId_deletedAt_idx" ON "content_entries"("tenantId", "contentTypeId", "deletedAt");

-- CreateIndex
CREATE INDEX "content_entries_deletedAt_idx" ON "content_entries"("deletedAt");
