import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

// Website Templates are platform catalog data (no tenantId FK — see
// prisma/schema.prisma), authored only via the platform-level
// mcp-global-schema MCP server. This admin listing shows every template
// (draft or published) with the same shape the old Global-workspace
// management UI used, now reached directly from /admin instead of through
// a tenant dashboard.
export const GET = withAdminAuth(async () => {
  const templates = await db.websiteTemplate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
      description: true, published: true, createdAt: true, updatedAt: true,
      demoUrl: true, price: true,
      schemaTemplate: { select: { id: true, name: true, slug: true, icon: true } },
      _count: { select: { deployedTenants: true, purchases: true } },
    },
  })

  return NextResponse.json({
    templates: templates.map((t) => ({ ...t, deployedCount: t._count.deployedTenants, soldCount: t._count.purchases, _count: undefined })),
  })
})
