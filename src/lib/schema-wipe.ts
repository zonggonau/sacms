import "server-only"
import { getTenantDb } from "@/lib/database"

/**
 * Deletes every tenant-owned ContentType/SingleType/Component row —
 * everything under them (fields, content entries, versions) cascades via
 * the schema's own onDelete: Cascade relations. Shared by the "Hapus Semua
 * Schema" action and the combined reset-website action, so the cascade-
 * delete logic lives in exactly one place.
 */
export async function wipeTenantSchema(
  tenantDb: Awaited<ReturnType<typeof getTenantDb>>,
  tenantId: string,
) {
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.deleteMany({ where: { tenantId } }),
    tenantDb.singleType.deleteMany({ where: { tenantId } }),
    tenantDb.component.deleteMany({ where: { tenantId } }),
  ])
  return {
    contentTypes: contentTypes.count,
    singleTypes: singleTypes.count,
    components: components.count,
  }
}
