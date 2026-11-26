import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { getWebsiteTemplateRun } from "@/lib/infrastructure/website-template-run"
import { isEnterpriseWorkspace, websiteTemplateAccess } from "@/lib/billing/website-template-access"

// Website Templates are platform catalog data (see prisma/schema.prisma —
// no tenantId FK, same as SchemaTemplate) and must be visible to every
// tenant regardless of dedicated-database status, so this always queries
// the plain shared `db` client, never getTenantDb(). Authoring (create) is
// MCP/ChatGPT-only — see src/app/api/mcp/global-schema — so there is no
// POST here, only GET.

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const templates = await db.websiteTemplate.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
      description: true, published: true, createdAt: true, updatedAt: true,
      demoUrl: true, price: true,
      schemaTemplate: { select: { id: true, name: true, slug: true, icon: true } },
    },
  })

  const [pending, purchases, enterprise] = await Promise.all([
    getWebsiteTemplateRun(access.tenantId),
    db.websiteTemplatePurchase.findMany({ where: { tenantId: access.tenantId }, select: { websiteTemplateId: true } }),
    isEnterpriseWorkspace(access.tenantId),
  ])
  const owned = new Set(purchases.map((p) => p.websiteTemplateId))
  return NextResponse.json({
    templates: templates.map((t) => ({ ...t, access: websiteTemplateAccess(owned.has(t.id), t.price, enterprise) })),
    pendingTemplateId: pending?.templateId ?? null,
  })
})
