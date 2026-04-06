import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]
 * Get a content type by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Use dynamic DB client (shared or dedicated)
    const tenantDb = await getTenantDb(tenant)

    // In our system, content types can be:
    // 1. Owned directly by the tenant (tenantId: access.tenantId)
    // 2. Global (tenantId: null) and assigned to the tenant (TenantContentTypeAssignment exists)
    let contentType = await tenantDb.contentType.findFirst({
      where: {
        slug: slug,
        OR: [
          { tenantId: access.tenantId },
          { 
            tenantId: null, 
            tenants: { some: { tenantId: access.tenantId, enabled: true } } 
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found or not assigned" }, { status: 404 })
    }

    // Parse field options from JSON string to object for better UI handling
    const formattedContentType = {
      ...contentType,
      fields: contentType.fields.map(field => {
        let parsedOptions = field.options
        if (typeof field.options === 'string') {
          try {
            parsedOptions = JSON.parse(field.options)
          } catch (e) {
            parsedOptions = {}
          }
        }
        return {
          ...field,
          options: parsedOptions
        }
      })
    }

    return NextResponse.json(formattedContentType)
  } catch (error) {
    console.error("Error fetching content type by slug:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}