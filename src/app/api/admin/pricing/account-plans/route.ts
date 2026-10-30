import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { accountPlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

// allowRoles on GET includes employee (Staf Internal, read-only — matches
// the pricing page's own canEdit split) alongside finance; editing prices
// is finance/super_admin-only since it directly controls what customers
// are charged.
export const GET = withAdminAuth(async () => {
  const plans = await db.accountPlan.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ plans })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, accountPlanSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.accountPlan.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })

  const plan = await db.accountPlan.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ plan }, { status: 201 })
}, { allowRoles: ["finance"] })
