import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const updateSiteSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["draft", "building", "published", "archived"]).optional(),
  customDomain: z.string().optional().nullable(),
  settings: z.any().optional(),
})

export const GET = withStaffAuth(async (_request, context, { access }) => {
  const { siteId } = await context.params
  const site = await db.site.findFirst({
    where: { id: siteId, tenantId: access.tenantId },
    include: {
      files: { orderBy: { path: "asc" } },
      versions: { orderBy: { version: "desc" }, take: 10 },
      deployments: { orderBy: { createdAt: "desc" }, take: 5 },
      conversations: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        include: { messages: { orderBy: { createdAt: "asc" } } },
      },
    },
  })
  if (!site) return apiError("not_found", { message: "Site not found" })
  return NextResponse.json({ site })
})

export const PUT = withStaffAuth(
  async (request, context, { access }) => {
    const { siteId } = await context.params
    const parsed = await readJson(request, updateSiteSchema)
    if (!parsed.ok) return parsed.response

    const site = await db.site.findFirst({ where: { id: siteId, tenantId: access.tenantId }, select: { id: true } })
    if (!site) return apiError("not_found", { message: "Site not found" })

    const updated = await db.site.update({ where: { id: siteId }, data: parsed.data })
    return NextResponse.json({ site: updated })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_request, context, { access }) => {
    const { siteId } = await context.params
    const site = await db.site.findFirst({ where: { id: siteId, tenantId: access.tenantId }, select: { id: true } })
    if (!site) return apiError("not_found", { message: "Site not found" })

    await db.site.delete({ where: { id: siteId } })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
