import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

type Context = { params: Promise<{ tenant: string; slug: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, slug: componentSlug } = await context.params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantDb = await getTenantDb(tenantSlug)

    const component = await tenantDb.component.findFirst({
      where: { 
        slug: componentSlug,
        OR: [
          { tenantId: null },
          { tenantId: access.tenantId }
        ]
      },
      include: {
        fields: {
          orderBy: { order: "asc" }
        },
        tenants: true
      }
    })

    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // In multi-tenant environments, components might be isolated.
    // Ensure this tenant has access to the component (either global or explicitly assigned)
    const hasAccess = component.tenants.length === 0 || component.tenants.some(t => t.tenantId === access.tenantId)
    
    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden: Component belongs to another workspace" }, { status: 403 })
    }

    return NextResponse.json(component)
  } catch (error) {
    console.error("Error fetching component by slug:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
