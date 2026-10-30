import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { aiCreditPackSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const PATCH = withAdminAuth(async (request, context) => {
  const { id } = await context.params
  const parsed = await readJson(request, aiCreditPackSchema.partial())
  if (!parsed.ok) return parsed.response

  const existing = await db.aiCreditPack.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Paket tidak ditemukan" })

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugTaken = await db.aiCreditPack.findUnique({ where: { slug: parsed.data.slug } })
    if (slugTaken) return apiError("conflict", { message: `Paket dengan slug "${parsed.data.slug}" sudah ada` })
  }

  const pack = await db.aiCreditPack.update({ where: { id }, data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ pack })
}, { allowRoles: ["finance"] })

export const DELETE = withAdminAuth(async (_request, context) => {
  const { id } = await context.params
  const existing = await db.aiCreditPack.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Paket tidak ditemukan" })

  await db.aiCreditPack.delete({ where: { id } })
  return NextResponse.json({ success: true })
}, { allowRoles: ["finance"] })
