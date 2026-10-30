import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { workspacePlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const GET = withAdminAuth(async () => {
  const plans = await db.workspacePlan.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ plans })
}, { allowRoles: ["employee", "finance"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, workspacePlanSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.workspacePlan.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })

  const plan = await db.workspacePlan.create({ data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
  return NextResponse.json({ plan }, { status: 201 })
}, { allowRoles: ["finance"] })
