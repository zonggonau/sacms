import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { workspacePlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { recordPricingChange } from "@/lib/billing/pricing-audit"

export const GET = withAdminAuth(async () => {
  const plans = await db.workspacePlan.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ plans })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request, _context, { session }) => {
  const parsed = await readJson(request, workspacePlanSchema)
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.workspacePlan.findUnique({ where: { slug: parsed.data.slug } })
    if (existing) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })

    const plan = await tx.workspacePlan.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
    await recordPricingChange(tx, session.user.id, "workspacePlan", "created", plan)
    return NextResponse.json({ plan }, { status: 201 })
  })
}, { allowRoles: ["finance"] })
