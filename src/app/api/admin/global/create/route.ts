import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

const GLOBAL_SLUG = "sacms-global"

/**
 * POST /api/admin/global/create
 * Creates the sacms-global tenant if it doesn't exist yet.
 * Does NOT seed any content — that is handled by /api/admin/global/seed.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "super_admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Check if already exists
    const existing = await db.tenant.findUnique({ where: { slug: GLOBAL_SLUG } })
    if (existing) {
      return NextResponse.json({
        success: true,
        created: false,
        alreadyExists: true,
        tenantId: existing.id,
        tenantSlug: existing.slug,
        message: "Global tenant already exists.",
      })
    }

    // Create the global tenant
    const tenant = await db.tenant.create({
      data: {
        name: "SaCMS Global",
        slug: GLOBAL_SLUG,
        description: "Internal system tenant for landing page and global content. Hidden from regular tenant lists.",
        plan: "enterprise",
        status: "active",
      },
    })

    return NextResponse.json({
      success: true,
      created: true,
      alreadyExists: false,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      message: "Global tenant created successfully. You can now seed the landing page content.",
    }, { status: 201 })
  } catch (error) {
    console.error("Global create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
