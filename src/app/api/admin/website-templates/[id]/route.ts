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

/**
 * Deleting a Website Template from this admin dashboard is a full cleanup,
 * unlike the MCP server's own `delete_website_template` tool (which
 * deliberately leaves the backing Schema Template alone — a SaCMS team
 * member might still be reusing it for a second frontend skin). Here:
 * delete the demo Vercel project (frontend), the Website Template row
 * itself, and — ONLY if no OTHER Website Template still follows the same
 * Schema Template, and it isn't the platform's `isDefault` one used to
 * auto-seed every new workspace — the Schema Template too, plus its own
 * internal demo tenant (an owner-less CMS workspace with nothing else
 * pointing at it once the schema is gone).
 *
 * A workspace that already applied this template is NEVER affected: it
 * materialized its own independent copy of the schema/content at apply
 * time (not a live reference to these catalog rows), and
 * Tenant.sourceWebsiteTemplateId is onDelete: SetNull — a purely
 * informational field, never gates anything.
 */
export const DELETE = withAdminAuth(async (_req, context) => {
  const { id } = await context.params
  const existing = await db.websiteTemplate.findUnique({ where: { id }, include: { schemaTemplate: true } })
  if (!existing) return apiError("not_found", { message: "Website Template tidak ditemukan" })

  if (existing.demoVercelProjectId) {
    const { deleteVercelProject } = await import("@/lib/vercel-client")
    await deleteVercelProject(existing.demoVercelProjectId).catch((err) =>
      console.warn(`[admin/website-templates] Failed to delete demo Vercel project for ${existing.slug}:`, err),
    )
  }

  await db.websiteTemplate.delete({ where: { id } })

  const schemaTemplate = existing.schemaTemplate
  let schemaDeleted = false
  if (schemaTemplate && !schemaTemplate.isDefault) {
    const remainingDependents = await db.websiteTemplate.count({ where: { schemaTemplateId: schemaTemplate.id } })
    if (remainingDependents === 0) {
      if (schemaTemplate.demoTenantId) {
        await db.tenant.delete({ where: { id: schemaTemplate.demoTenantId } }).catch((err) =>
          console.warn(`[admin/website-templates] Failed to delete demo tenant for schema ${schemaTemplate.slug}:`, err),
        )
      }
      await db.schemaTemplate
        .delete({ where: { id: schemaTemplate.id } })
        .then(() => { schemaDeleted = true })
        .catch((err) => console.warn(`[admin/website-templates] Failed to delete backing schema ${schemaTemplate.slug}:`, err))
    }
  }

  return NextResponse.json({ success: true, schemaDeleted })
})
