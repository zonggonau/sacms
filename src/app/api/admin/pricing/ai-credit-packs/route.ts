import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { aiCreditPackSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { recordPricingChange } from "@/lib/billing/pricing-audit"

export const GET = withAdminAuth(async () => {
  const packs = await db.aiCreditPack.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ packs })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request, _context, { session }) => {
  const parsed = await readJson(request, aiCreditPackSchema)
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.aiCreditPack.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) return apiError("conflict", { message: `Paket dengan slug "${parsed.data.slug}" sudah ada` })

    const pack = await tx.aiCreditPack.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
    await recordPricingChange(tx, session.user.id, "aiCreditPack", "created", pack)
    return NextResponse.json({ pack }, { status: 201 })
  })
}, { allowRoles: ["finance"] })
