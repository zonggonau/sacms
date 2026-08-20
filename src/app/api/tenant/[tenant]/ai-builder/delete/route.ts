import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { deleteV0Chat } from "@/lib/v0-client"

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
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })

    const tenant = access.tenant

    // 1. Fetch current v0ChatId from settings
    const chatIdSetting = await db.setting.findUnique({
      where: { key: `${tenant.id}_v0ChatId` }
    })
    const v0ChatId = chatIdSetting?.value

    // 2. Delete chat on v0 if exists
    if (v0ChatId) {
      try {
        await deleteV0Chat(v0ChatId)
      } catch (err: any) {
        console.warn("Could not delete v0 chat:", err.message)
      }
    }

    // 3. Clear all related settings
    await db.setting.deleteMany({
      where: {
        tenantId: tenant.id,
        key: {
          in: [
            `${tenant.id}_v0ChatId`,
            `${tenant.id}_v0PreviewUrl`,
            `${tenant.id}_v0FrontendPrompt`,
            `${tenant.id}_v0Status`,
            `${tenant.id}_vercelProjectId`,
          ]
        }
      }
    })

    // 4. Delete Site and SiteFiles if any
    const site = await db.site.findFirst({
      where: { tenantId: tenant.id }
    })
    if (site) {
      await db.siteFile.deleteMany({
        where: { siteId: site.id }
      })
      await db.site.delete({
        where: { id: site.id }
      })
    }

    return NextResponse.json({
      success: true,
      message: "Draft / Project berhasil dihapus."
    })
  } catch (error: any) {
    console.error("Delete draft/project failed:", error)
    return NextResponse.json({ error: error.message || "Gagal menghapus draft" }, { status: 500 })
  }
}
