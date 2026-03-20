-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'REJECTED');

-- AlterTable
ALTER TABLE "component_fields" ADD COLUMN     "jsonPath" TEXT,
ADD COLUMN     "localizable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "relationSlug" TEXT,
ADD COLUMN     "unique" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "content_type_fields" ADD COLUMN     "jsonPath" TEXT,
ADD COLUMN     "localizable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "relationSlug" TEXT;

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "mediumUrl" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- AlterTable
ALTER TABLE "single_type_fields" ADD COLUMN     "jsonPath" TEXT,
ADD COLUMN     "localizable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "relationSlug" TEXT,
ADD COLUMN     "unique" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "webhooks" ADD COLUMN     "hookType" TEXT NOT NULL DEFAULT 'async';

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "contentEntryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "changeType" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_locales" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenant_locales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_versions_contentEntryId_createdAt_idx" ON "content_versions"("contentEntryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_contentEntryId_version_key" ON "content_versions"("contentEntryId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_locales_tenantId_locale_key" ON "tenant_locales"("tenantId", "locale");

-- CreateIndex
CREATE INDEX "content_entries_tenantId_contentTypeId_status_idx" ON "content_entries"("tenantId", "contentTypeId", "status");

-- CreateIndex
CREATE INDEX "content_entries_tenantId_locale_idx" ON "content_entries"("tenantId", "locale");

-- CreateIndex
CREATE INDEX "content_entries_status_scheduledAt_idx" ON "content_entries"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "content_entries_tenantId_status_idx" ON "content_entries"("tenantId", "status");

-- CreateIndex
CREATE INDEX "media_tenantId_mimeType_idx" ON "media"("tenantId", "mimeType");

-- AddForeignKey
ALTER TABLE "content_entries" ADD CONSTRAINT "content_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_contentEntryId_fkey" FOREIGN KEY ("contentEntryId") REFERENCES "content_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_locales" ADD CONSTRAINT "tenant_locales_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
