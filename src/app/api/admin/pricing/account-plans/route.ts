import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { accountPlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { recordPricingChange } from "@/lib/billing/pricing-audit"

// allowRoles on GET includes employee (Staf Internal, read-only — matches
// the pricing page's own canEdit split) alongside finance; editing prices
// is finance/super_admin-only since it directly controls what customers
// are charged.
export const GET = withAdminAuth(async () => {
  const plans = await db.accountPlan.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ plans })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request, _context, { session }) => {
  const parsed = await readJson(request, accountPlanSchema)
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.accountPlan.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })

    const plan = await tx.accountPlan.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
    await recordPricingChange(tx, session.user.id, "accountPlan", "created", plan)
    return NextResponse.json({ plan }, { status: 201 })
  })
}, { allowRoles: ["finance"] })
