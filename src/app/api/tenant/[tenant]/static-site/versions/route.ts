import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

// Lists this tenant's static site version history (most recent first) —
// snapshotted automatically on every publish/rollback, see
// src/lib/static-site-versions.ts.
export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const site = await db.tenantStaticSite.findUnique({ where: { tenantId: access.tenantId } })
  if (!site) return NextResponse.json({ versions: [] })

  const versions = await db.tenantStaticSiteVersion.findMany({
    where: { siteId: site.id },
    orderBy: { publishedAt: "desc" },
    select: { id: true, prompt: true, publishedAt: true },
  })

  return NextResponse.json({ versions })
})
