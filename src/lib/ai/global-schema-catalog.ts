import "server-only"
import { db, getTenantDb } from "@/lib/database"
import { getGlobalWorkspaceId } from "@/lib/settings"
import { serializeTenantSchema } from "@/lib/schema-template-sync"
import { EMPTY_GLOBAL_CATALOG, type GlobalSchemaCatalog } from "@/lib/ai/global-schema-reuse"

/**
 * Reads the SaCMS Global workspace's own default Content Types, Single Types
 * and Components, in the same bundle shape the import path uses. Draft-tagged
 * rows (staging for a template being edited) are left out. A missing Global
 * workspace yields an empty catalog, and the generator then works as before.
 */
export async function loadGlobalSchemaCatalog(): Promise<GlobalSchemaCatalog> {
  const globalId = await getGlobalWorkspaceId()
  const tenant = await db.tenant.findFirst({
    where: { OR: [{ id: globalId }, { slug: globalId }] },
    select: { id: true, slug: true },
  })
  if (!tenant) return EMPTY_GLOBAL_CATALOG

  const tenantDb = await getTenantDb(tenant.slug)
  const bundle = await serializeTenantSchema(tenantDb, { tenantId: tenant.id, draftTemplateId: null } as any)
  return {
    contentTypes: bundle.contentTypes,
    singleTypes: bundle.singleTypes,
    components: bundle.components,
  }
}
