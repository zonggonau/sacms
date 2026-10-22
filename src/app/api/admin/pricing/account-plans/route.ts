import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { accountPlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

// allowRoles: ["admin"] on GET only (matches the billing section's own
// read-vs-write split) — editing prices is kept super_admin-only since it
// directly controls what customers are charged.
export const GET = withAdminAuth(async () => {
  const plans = await db.accountPlan.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ plans })
}, { allowRoles: ["admin"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, accountPlanSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.accountPlan.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })

  const plan = await db.accountPlan.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ plan }, { status: 201 })
})
