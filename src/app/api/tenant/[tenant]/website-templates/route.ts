import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

// Website Templates are platform catalog data (see prisma/schema.prisma —
// no tenantId FK, same as SchemaTemplate) and must be visible to every
// tenant regardless of dedicated-database status, so this always queries
// the plain shared `db` client, never getTenantDb(). Authoring (create) is
// MCP/ChatGPT-only — see src/app/api/mcp/global-schema — so there is no
// POST here, only GET.

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const templates = await db.websiteTemplate.findMany({
    where: access.isGlobal ? {} : { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
      description: true, published: true, createdAt: true, updatedAt: true,
      demoUrl: true,
      schemaTemplate: { select: { id: true, name: true, slug: true, icon: true } },
    },
  })

  return NextResponse.json({ templates })
})
