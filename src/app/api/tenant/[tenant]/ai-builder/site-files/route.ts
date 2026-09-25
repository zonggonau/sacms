import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

/**
 * Get the latest generated files for this tenant's website from database.
 */
export const GET = withStaffAuth(
  async (_req, _context, { access }) => {
    const site = await db.site.findFirst({
      where: { tenantId: access.tenantId },
      orderBy: { updatedAt: "desc" },
      include: {
        files: { orderBy: { path: "asc" } },
      },
    })

    if (!site || site.files.length === 0) {
      return NextResponse.json({ files: [] })
    }

    return NextResponse.json({
      files: site.files.map((f) => ({
        name: f.path,
        content: f.content,
      })),
    })
  },
  { minRole: "viewer" },
)
