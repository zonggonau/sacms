import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
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

    // In our system, provisioned content types have slugs like `${tenantId}-${baseSlug}`
    // We should try to find by that first, then fall back to the literal slug.
    let contentType = await db.contentType.findFirst({
      where: {
        OR: [
          { slug: `${access.tenantId}-${slug}` },
          { slug: slug }
        ]
      },
      include: {
        fields: {
          orderBy: { order: 'asc' },
        },
        tenants: {
          where: { tenantId: access.tenantId }
        }
      },
    })

    // Security check: Ensure this content type is assigned to this tenant
    // (A content type is assigned if it either belongs directly to the tenant OR has an entry in TenantContentTypeAssignment)
    const isAssigned = contentType && (contentType.tenantId === access.tenantId || contentType.tenants.length > 0)

    if (!contentType || !isAssigned) {
      return NextResponse.json({ error: "Content type not found or not assigned" }, { status: 404 })
    }

    return NextResponse.json(contentType)
  } catch (error) {
    console.error("Error fetching content type by slug:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}