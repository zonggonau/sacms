import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

const saveFileSchema = z.object({
  path: z.string().min(1, "Path file tidak boleh kosong"),
  content: z.string(),
  isBinary: z.boolean().default(false),
})

export const POST = withStaffAuth(
  async (request, context, { access }) => {
    const { siteId } = await context.params
    const site = await db.site.findFirst({ where: { id: siteId, tenantId: access.tenantId }, select: { id: true } })
    if (!site) return apiError("not_found", { message: "Site not found" })

    const parsed = await readJson(request, saveFileSchema)
    if (!parsed.ok) return parsed.response
    const { path, content, isBinary } = parsed.data

    const file = await db.siteFile.upsert({
      where: { siteId_path: { siteId: site.id, path } },
      create: { siteId: site.id, path, content, isBinary },
      update: { content, isBinary },
    })
    await db.site.update({ where: { id: site.id }, data: { updatedAt: new Date() } })

    return NextResponse.json({ file })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (request, context, { access }) => {
    const { siteId } = await context.params
    const filePath = new URL(request.url).searchParams.get("path")
    if (!filePath) return apiError("validation", { message: "Parameter path wajib diisi" })

    await db.siteFile.deleteMany({
      where: { siteId, path: filePath, site: { tenantId: access.tenantId } },
    })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
