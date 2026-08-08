import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string; slug: string; entryId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug, entryId } = await params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const tenantDb = await getTenantDb(tenantSlug)

    const versions = await tenantDb.contentVersion.findMany({
      where: { contentEntryId: entryId },
      orderBy: { version: "desc" },
      select: {
        id: true,
        version: true,
        changeType: true,
        changedBy: true,
        changeSummary: true,
        createdAt: true,
        publishedAt: true,
      },
    })

    return NextResponse.json({ versions })
  } catch (error: any) {
    console.error("Error fetching entry versions:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
