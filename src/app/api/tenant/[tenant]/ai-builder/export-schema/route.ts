import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

export const GET = withStaffAuth(async (_req, context, { access }) => {
    const { tenant: tenantSlug } = await context.params
    const tenantDb = await getTenantDb(tenantSlug)

    // Fetch Content Types
    const contentTypes = await tenantDb.contentType.findMany({
      where: { tenantId: access.tenant.id },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Fetch Single Types
    const singleTypes = await tenantDb.singleType.findMany({
      where: { tenantId: access.tenant.id },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Fetch Components
    const components = await tenantDb.component.findMany({
      where: { tenantId: access.tenant.id },
      include: {
        schemaFields: {
          orderBy: { order: 'asc' }
        }
      }
    })

    // Format output
    const formatFields = (fields: any[]) => fields.map(f => {
      const fieldData: any = {
        name: f.name,
        slug: f.slug,
        type: f.type,
        required: f.required,
        unique: f.unique,
      }
      if (f.relationSlug) fieldData.relationSlug = f.relationSlug
      if (f.options?.componentSlug) fieldData.componentSlug = f.options.componentSlug
      return fieldData
    })

    const schema = {
      contentTypes: contentTypes.map(ct => ({
        name: ct.name,
        slug: ct.slug,
        description: ct.description,
        fields: formatFields(ct.schemaFields)
      })),
      singleTypes: singleTypes.map(st => ({
        name: st.name,
        slug: st.slug,
        description: st.description,
        fields: formatFields(st.schemaFields)
      })),
      components: components.map(comp => ({
        name: comp.name,
        slug: comp.slug,
        description: comp.description,
        fields: formatFields(comp.schemaFields)
      }))
    }

    return NextResponse.json(schema)
})
