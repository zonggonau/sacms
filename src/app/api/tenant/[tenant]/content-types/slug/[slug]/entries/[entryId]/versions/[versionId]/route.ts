import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; entryId: string; versionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, versionId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantDb = await getTenantDb(tenantSlug)

    const version = await tenantDb.contentVersion.findUnique({
      where: { id: versionId },
    })

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 })
    }

    return NextResponse.json({ version })
  } catch (error: any) {
    console.error("Error fetching version details:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
