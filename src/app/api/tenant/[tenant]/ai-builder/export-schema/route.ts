import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { getTenantDb } from "@/lib/database"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    
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
  } catch (error: any) {
    console.error("Failed to export schema:", error)
    return NextResponse.json({ error: error.message || "Failed to export schema" }, { status: 500 })
  }
}
