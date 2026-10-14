import type { PrismaClient, Prisma } from "../../prisma/generated-client"

/**
 * Shared JSON<->real-rows conversion for `{contentTypes, singleTypes,
 * components}` schema blobs. Both directions were originally written
 * standalone in import-schema/route.ts and export-schema/route.ts; they're
 * extracted here so Schema Template materialization/snapshot (see
 * api/tenant/[tenant]/schema-templates/[id]/materialize and sync) can reuse
 * the exact same logic instead of a parallel copy.
 */

interface SchemaFieldInput {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string
  componentSlug?: string
}

interface SchemaModelInput {
  name: string
  slug: string
  description?: string
  fields?: SchemaFieldInput[]
}

export interface SchemaBlob {
  contentTypes?: SchemaModelInput[]
  singleTypes?: SchemaModelInput[]
  components?: SchemaModelInput[]
}

function fieldsToCreateInput(fields: SchemaFieldInput[] | undefined) {
  return (fields || []).map((f, i) => ({
    name: f.name,
    slug: f.slug,
    type: f.type,
    required: !!f.required,
    unique: !!f.unique,
    order: i,
    relationSlug: f.type === "relation" ? f.relationSlug : null,
    options: f.type === "component" ? { componentSlug: f.componentSlug } : undefined,
  }))
}

/**
 * Creates ContentType/SingleType/Component + SchemaField rows from a schema
 * blob for the given tenant, skipping any model whose slug already exists.
 * `extraData` is merged into every created model's top-level `data` — used
 * to stamp `draftTemplateId` for template materialization; omit it for a
 * normal tenant import.
 *
 * Runs as one interactive transaction so a failure partway through (e.g. a
 * slug collision from a concurrent request) rolls back everything already
 * created in this call instead of leaving the tenant with a half-imported
 * schema and no way to tell which models landed.
 */
export async function materializeSchemaIntoTenant(
  tenantDb: PrismaClient,
  tenantId: string,
  schema: SchemaBlob,
  extraData: Record<string, unknown> = {},
): Promise<{ imported: number }> {
  return tenantDb.$transaction(async (tx) => {
    let imported = 0

    for (const ct of schema.contentTypes || []) {
      if (!ct.slug || !ct.name) continue
      const exists = await tx.contentType.findFirst({ where: { slug: ct.slug, tenantId } })
      if (exists) continue
      await tx.contentType.create({
        data: {
          tenantId,
          name: ct.name,
          slug: ct.slug,
          description: ct.description || "",
          isPublished: true,
          schemaFields: { create: fieldsToCreateInput(ct.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    for (const st of schema.singleTypes || []) {
      if (!st.slug || !st.name) continue
      const exists = await tx.singleType.findFirst({ where: { slug: st.slug, tenantId } })
      if (exists) continue
      await tx.singleType.create({
        data: {
          tenantId,
          name: st.name,
          slug: st.slug,
          description: st.description || "",
          isPublished: true,
          schemaFields: { create: fieldsToCreateInput(st.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    for (const comp of schema.components || []) {
      if (!comp.slug || !comp.name) continue
      const exists = await tx.component.findFirst({ where: { slug: comp.slug, tenantId } })
      if (exists) continue
      await tx.component.create({
        data: {
          tenantId,
          name: comp.name,
          slug: comp.slug,
          description: comp.description || "",
          schemaFields: { create: fieldsToCreateInput(comp.fields) },
          tenants: { create: { tenantId } },
          ...extraData,
        },
      })
      imported++
    }

    return { imported }
  }, { timeout: 20000 })
}

function formatFields(fields: { name: string; slug: string; type: string; required: boolean; unique: boolean; relationSlug: string | null; options: unknown }[]) {
  return fields.map((f) => {
    const fieldData: SchemaFieldInput = {
      name: f.name,
      slug: f.slug,
      type: f.type,
      required: f.required,
      unique: f.unique,
    }
    if (f.relationSlug) fieldData.relationSlug = f.relationSlug
    const opts = f.options as { componentSlug?: string } | null | undefined
    if (opts?.componentSlug) fieldData.componentSlug = opts.componentSlug
    return fieldData
  })
}

/**
 * Serializes a tenant's (or a tagged subset of a tenant's) Content
 * Types/Single Types/Components + fields back into the same
 * `{contentTypes, singleTypes, components}` shape materializeSchemaIntoTenant
 * consumes. `where` lets callers scope to a draft template's tagged rows
 * instead of the whole tenant.
 */
export async function serializeTenantSchema(
  tenantDb: PrismaClient,
  where: Prisma.ContentTypeWhereInput & Prisma.SingleTypeWhereInput & Prisma.ComponentWhereInput,
) {
  const [contentTypes, singleTypes, components] = await Promise.all([
    tenantDb.contentType.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
    tenantDb.singleType.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
    tenantDb.component.findMany({ where, include: { schemaFields: { orderBy: { order: "asc" } } } }),
  ])

  return {
    contentTypes: contentTypes.map((ct) => ({
      name: ct.name,
      slug: ct.slug,
      description: ct.description,
      fields: formatFields(ct.schemaFields),
    })),
    singleTypes: singleTypes.map((st) => ({
      name: st.name,
      slug: st.slug,
      description: st.description,
      fields: formatFields(st.schemaFields),
    })),
    components: components.map((comp) => ({
      name: comp.name,
      slug: comp.slug,
      description: comp.description,
      fields: formatFields(comp.schemaFields),
    })),
  }
}
