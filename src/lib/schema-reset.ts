import "server-only"
import { db, getTenantDb } from "@/lib/database"
import { wipeTenantSchema } from "@/lib/schema-wipe"
import { seedDefaultTenantSchema } from "@/lib/infrastructure/default-tenant-schema"
import { ensureSiteSettings } from "@/lib/infrastructure/site-settings"
import { finalizeSchema } from "@/lib/schema-lock"

/**
 * Reset total schema: deletes every Content Type, Single Type and Component this workspace owns
 * (fields and entries cascade), then imports the default starter schema, the same Single Types and
 * Components a brand-new workspace receives. Content Types such as Post or Kategori stay opt-in,
 * as in seedDefaultTenantSchema. site-settings is ensured last, since the wipe removes it too.
 *
 * Callers own their gates (role, Global block, draft lock). Re-running it is safe: the wipe finds
 * nothing left to delete and the seed skips models that already exist.
 */
export async function resetSchemaToStarter(tenantId: string, tenantSlug: string) {
  const tenantDb = await getTenantDb(tenantSlug)
  const deleted = await wipeTenantSchema(tenantDb, tenantId)
  await seedDefaultTenantSchema(tenantId)
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true } })
  await ensureSiteSettings(tenantId, tenant?.name ?? tenantSlug)
  await finalizeSchema(tenantId)
  return deleted
}
