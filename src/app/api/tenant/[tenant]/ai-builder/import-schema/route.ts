import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const { schema } = await req.json()
    if (!schema || typeof schema !== "object") {
      return NextResponse.json({ error: "Invalid schema provided" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    
    const tenant = access.tenant
    const tenantDb = await getTenantDb(tenant.slug)

    // Insert into DB
    let importedCount = 0

    if (Array.isArray(schema.contentTypes)) {
      for (const ct of schema.contentTypes) {
        if (!ct.slug || !ct.name) continue
        const exists = await tenantDb.contentType.findFirst({ where: { slug: ct.slug, tenantId: tenant.id } })
        if (!exists) {
          await tenantDb.contentType.create({
            data: {
              tenantId: tenant.id,
              name: ct.name,
              slug: ct.slug,
              description: ct.description || "",
              isPublished: true,
              schemaFields: {
                create: (ct.fields || []).map((f: any, i: number) => ({
                  name: f.name, 
                  slug: f.slug, 
                  type: f.type, 
                  required: !!f.required, 
                  unique: !!f.unique, 
                  order: i, 
                  relationSlug: f.type === 'relation' ? f.relationSlug : null,
                  options: f.type === 'component' ? { componentSlug: f.componentSlug } : undefined
                }))
              },
              tenants: { create: { tenantId: tenant.id } }
            }
          })
          importedCount++
        }
      }
    }

    if (Array.isArray(schema.singleTypes)) {
      for (const st of schema.singleTypes) {
        if (!st.slug || !st.name) continue
        const exists = await tenantDb.singleType.findFirst({ where: { slug: st.slug, tenantId: tenant.id } })
        if (!exists) {
          await tenantDb.singleType.create({
            data: {
              tenantId: tenant.id,
              name: st.name,
              slug: st.slug,
              description: st.description || "",
              isPublished: true,
              schemaFields: {
                create: (st.fields || []).map((f: any, i: number) => ({
                  name: f.name, 
                  slug: f.slug, 
                  type: f.type, 
                  required: !!f.required, 
                  unique: !!f.unique, 
                  order: i, 
                  relationSlug: f.type === 'relation' ? f.relationSlug : null,
                  options: f.type === 'component' ? { componentSlug: f.componentSlug } : undefined
                }))
              },
              tenants: { create: { tenantId: tenant.id } }
            }
          })
          importedCount++
        }
      }
    }

    if (Array.isArray(schema.components)) {
      for (const comp of schema.components) {
        if (!comp.slug || !comp.name) continue
        const exists = await tenantDb.component.findFirst({ where: { slug: comp.slug, tenantId: tenant.id } })
        if (!exists) {
          await tenantDb.component.create({
            data: {
              tenantId: tenant.id,
              name: comp.name,
              slug: comp.slug,
              description: comp.description || "",
              schemaFields: {
                create: (comp.fields || []).map((f: any, i: number) => ({
                  name: f.name, 
                  slug: f.slug, 
                  type: f.type, 
                  required: !!f.required, 
                  unique: !!f.unique, 
                  order: i, 
                  relationSlug: f.type === 'relation' ? f.relationSlug : null,
                  options: f.type === 'component' ? { componentSlug: f.componentSlug } : undefined
                }))
              },
              tenants: { create: { tenantId: tenant.id } }
            }
          })
          importedCount++
        }
      }
    }

    return NextResponse.json({ success: true, imported: importedCount })
  } catch (error: any) {
    console.error("Schema import failed:", error)
    return NextResponse.json({ error: error.message || "Failed to import schema" }, { status: 500 })
  }
}
