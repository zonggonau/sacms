/**
 * GET /api/admin/global/components
 * List all global/system-level components (tenantId: null)
 * Used for managing SaCMS frontend components from admin panel
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
    if (!session?.user || !adminRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const components = await db.component.findMany({
      where: { tenantId: null },
      include: {
        schemaFields: {
          select: { id: true, name: true, type: true, slug: true },
          orderBy: { order: "asc" },
        },
        _count: { select: { contentTypes: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const enriched = components.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      fields: c.schemaFields,
      entryCount: c._count.contentTypes,
      createdAt: c.createdAt.toISOString(),
    }))

    return NextResponse.json({ components: enriched, total: enriched.length })
  } catch (err) {
    console.error("Error fetching global components:", err)
    return NextResponse.json({ error: "Failed to fetch components" }, { status: 500 })
  }
}
