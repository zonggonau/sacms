import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { workspacePlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const PATCH = withAdminAuth(async (request, context) => {
  const { id } = await context.params
  const parsed = await readJson(request, workspacePlanSchema.partial())
  if (!parsed.ok) return parsed.response

  const existing = await db.workspacePlan.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Plan tidak ditemukan" })

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugTaken = await db.workspacePlan.findUnique({ where: { slug: parsed.data.slug } })
    if (slugTaken) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })
  }

  const plan = await db.workspacePlan.update({ where: { id }, data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ plan })
}, { allowRoles: ["finance"] })

export const DELETE = withAdminAuth(async (_request, context) => {
  const { id } = await context.params
  const existing = await db.workspacePlan.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Plan tidak ditemukan" })

  await db.workspacePlan.delete({ where: { id } })
  return NextResponse.json({ success: true })
}, { allowRoles: ["finance"] })
