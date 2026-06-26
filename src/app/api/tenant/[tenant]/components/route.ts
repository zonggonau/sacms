import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

type Context = { params: Promise<{ tenant: string }> }

export async function GET(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantDb = await getTenantDb(tenantSlug)

    // Components are stored globally or per-tenant.
    // Fetch components that this tenant has access to.
    const components = await tenantDb.component.findMany({
      include: {
        fields: {
          orderBy: { order: "asc" }
        },
        tenants: true
      },
      orderBy: { createdAt: "desc" }
    })
    
    // In multi-tenant environments, components might be isolated.
    // We return components that either have NO tenant assignments (global)
    // or are explicitly assigned to this tenant.
    const availableComponents = components.filter(c => 
      c.tenants.length === 0 || c.tenants.some(t => t.tenantId === access.tenantId)
    )

    return NextResponse.json(availableComponents)
  } catch (error) {
    console.error("Error fetching components:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
