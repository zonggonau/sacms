-- Nested (up to 3 levels, enforced in src/actions/content-type-groups.ts)
-- content-type groups for organizing the CMS sidebar's "Koleksi Konten"
-- section into collapsible dropdowns.

-- CreateTable
CREATE TABLE "content_type_groups" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_type_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_type_groups_tenantId_idx" ON "content_type_groups"("tenantId");

-- CreateIndex
CREATE INDEX "content_type_groups_parentId_idx" ON "content_type_groups"("parentId");

-- AddForeignKey
ALTER TABLE "content_type_groups" ADD CONSTRAINT "content_type_groups_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_type_groups" ADD CONSTRAINT "content_type_groups_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "content_type_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "content_types" ADD COLUMN "groupId" TEXT;
ALTER TABLE "content_types" ADD COLUMN "groupOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "content_types_groupId_idx" ON "content_types"("groupId");

-- AddForeignKey
ALTER TABLE "content_types" ADD CONSTRAINT "content_types_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "content_type_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
