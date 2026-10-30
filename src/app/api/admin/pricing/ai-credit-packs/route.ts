import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { aiCreditPackSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const GET = withAdminAuth(async () => {
  const packs = await db.aiCreditPack.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ packs })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, aiCreditPackSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.aiCreditPack.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Paket dengan slug "${parsed.data.slug}" sudah ada` })

  const pack = await db.aiCreditPack.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ pack }, { status: 201 })
}, { allowRoles: ["finance"] })
