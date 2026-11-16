import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { updateWebsiteTemplateSchema } from "@/lib/validations/website-template"

export const PATCH = withAdminAuth(async (req, context) => {
  const { id } = await context.params
  const existing = await db.websiteTemplate.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Website Template tidak ditemukan" })

  const parsed = await readJson(req, updateWebsiteTemplateSchema)
  if (!parsed.ok) return parsed.response

  const template = await db.websiteTemplate.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ template })
})

export const DELETE = withAdminAuth(async (_req, context) => {
  const { id } = await context.params
  const existing = await db.websiteTemplate.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Website Template tidak ditemukan" })

  if (existing.demoVercelProjectId) {
    const { deleteVercelProject } = await import("@/lib/vercel-client")
    await deleteVercelProject(existing.demoVercelProjectId).catch((err) =>
      console.warn(`[admin/website-templates] Failed to delete demo Vercel project for ${existing.slug}:`, err),
    )
  }

  await db.websiteTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
