import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

export const dynamic = "force-dynamic"

// GET /api/support/unread-count - Get unread count for current user/tenant or super admin
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ unreadCount: 0 })
    }

    const { searchParams } = new URL(request.url)
    const tenantSlugOrId = searchParams.get("tenant")

    const isSuperAdmin = session.user.role === "super_admin"

    if (isSuperAdmin && !tenantSlugOrId) {
      // Super admin global inbox: count unread messages sent by users
      const count = await db.supportMessage.count({
        where: {
          senderRole: "user",
          isRead: false,
        }
      })
      return NextResponse.json({ unreadCount: count })
    }

    if (tenantSlugOrId) {
      const tenant = await db.tenant.findFirst({
        where: { OR: [{ id: tenantSlugOrId }, { slug: tenantSlugOrId }] },
        select: { id: true }
      })

      if (!tenant) {
        return NextResponse.json({ unreadCount: 0 })
      }

      // Tenant inbox: count unread messages sent by admin
      const count = await db.supportMessage.count({
        where: {
          ticket: { tenantId: tenant.id },
          senderRole: "admin",
          isRead: false,
        }
      })

      return NextResponse.json({ unreadCount: count })
    }

    // Default user unread tickets
    const count = await db.supportMessage.count({
      where: {
        ticket: { userId: session.user.id },
        senderRole: "admin",
        isRead: false,
      }
    })

    return NextResponse.json({ unreadCount: count })
  } catch (error: any) {
    return NextResponse.json({ unreadCount: 0 })
  }
}
