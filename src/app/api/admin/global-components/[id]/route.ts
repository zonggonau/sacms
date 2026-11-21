import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, apiError, readJson } from "@/lib/api/route-helpers"
import { updateGlobalComponentSchema } from "@/lib/validations/global-component"

// Admin surface for GlobalComponent is deliberately read + publish-toggle
// only (see /admin/developer/schema) — this PATCH reuses
// updateGlobalComponentSchema (same shape the global-schema MCP server's own
// update_global_component validates against) but in practice the admin UI
// only ever sends { published }. Editing `fields` stays MCP-only.
export const PATCH = withAdminAuth(async (req, context) => {
  const { id } = await context.params
  const existing = await db.globalComponent.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Global Component tidak ditemukan" })

  const parsed = await readJson(req, updateGlobalComponentSchema)
  if (!parsed.ok) return parsed.response

  const component = await db.globalComponent.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ component })
})

export const DELETE = withAdminAuth(async (_req, context) => {
  const { id } = await context.params
  const existing = await db.globalComponent.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Global Component tidak ditemukan" })

  await db.globalComponent.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
