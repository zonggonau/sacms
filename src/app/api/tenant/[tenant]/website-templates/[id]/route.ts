import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { updateWebsiteTemplateSchema } from "@/lib/validations/website-template"

export const GET = withStaffAuth(async (_req, context, { access }) => {
  const { id } = await context.params
  const template = await db.websiteTemplate.findUnique({
    where: { id },
    include: { schemaTemplate: { select: { id: true, name: true, slug: true, icon: true, schema: true } } },
  })
  if (!template) return apiError("not_found", { message: "Website Template tidak ditemukan" })

  // Regular tenants may only preview a PUBLISHED template (same visibility
  // rule as the list route) — the review dialog uses this for both
  // audiences, so a draft Website Template must 404 here too, not just be
  // filtered out of the list.
  if (!access.isGlobal && !template.published) {
    return apiError("not_found", { message: "Website Template tidak ditemukan" })
  }

  return NextResponse.json({ template })
})

export const PATCH = withStaffAuth(
  async (req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat mengubah Website Template" })
    }

    const { id } = await context.params
    const existing = await db.websiteTemplate.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Website Template tidak ditemukan" })

    const parsed = await readJson(req, updateWebsiteTemplateSchema)
    if (!parsed.ok) return parsed.response

    const template = await db.websiteTemplate.update({
      where: { id },
      data: parsed.data,
    })

    return NextResponse.json({ template })
  },
  { minRole: "admin" },
)

export const DELETE = withStaffAuth(
  async (_req, context, { access }) => {
    if (!access.isGlobal) {
      return apiError("forbidden", { message: "Hanya workspace SaCMS Global yang dapat menghapus Website Template" })
    }

    const { id } = await context.params
    const existing = await db.websiteTemplate.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Website Template tidak ditemukan" })

    if (existing.demoVercelProjectId) {
      const { deleteVercelProject } = await import("@/lib/vercel-client")
      await deleteVercelProject(existing.demoVercelProjectId).catch((err) =>
        console.warn(`[website-templates] Failed to delete demo Vercel project for ${existing.slug}:`, err),
      )
    }

    await db.websiteTemplate.delete({ where: { id } })

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
