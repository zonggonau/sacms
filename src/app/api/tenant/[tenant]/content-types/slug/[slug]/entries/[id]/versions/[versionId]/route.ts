import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/content-types/slug/[slug]/entries/[id]/versions/[versionId]
 * Get data for a specific version
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; id: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant, slug, id, versionId } = await params

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

    // Get version
    const version = await tenantDb.contentVersion.findFirst({
      where: {
        id: versionId,
        contentEntryId: id,
      },
    })

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    return NextResponse.json({ version })
  } catch (error) {
    console.error("Error fetching version:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
