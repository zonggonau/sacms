import "server-only"
import { getTenantDb } from "@/lib/database"
import { removeMemberGrantsForContentTypes } from "@/lib/member-permission-cleanup"

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
  // Member grants for these Content Types go too, so a future type with the same slug starts clean.
  const types = await tenantDb.contentType.findMany({ where: { tenantId }, select: { slug: true } })
  await removeMemberGrantsForContentTypes(tenantDb, tenantId, types.map((t) => t.slug))

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
