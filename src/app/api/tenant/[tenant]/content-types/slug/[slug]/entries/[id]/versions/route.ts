import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/versions
 * Get all versions for a specific entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id } = await params

    const access = await getTenantAccess(session, tenant)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const tenantDb = await getTenantDb(tenant)

    // Verify content type
    const contentType = await tenantDb.contentType.findUnique({
      where: { slug },
    })

    if (!contentType) {
      return NextResponse.json({ error: "Content type not found" }, { status: 404 })
    }

    // Get versions
    const versions = await tenantDb.contentVersion.findMany({
      where: {
        contentEntryId: id,
      },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        changeType: true,
        changedBy: true,
        changeSummary: true,
        createdAt: true,
        publishedAt: true,
        // We don't select 'data' here to keep payload small, 
        // unless a specific version is requested by ID
      }
    })

    return NextResponse.json({ versions })
  } catch (error) {
    console.error("Error fetching versions:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/versions/restore
 * (Handle restore via a sub-route or action parameter)
 */
