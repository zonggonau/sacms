import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { vpsOfferingSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const GET = withAdminAuth(async () => {
  const offerings = await db.vpsOffering.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ vpsOfferings: offerings })
}, { allowRoles: ["admin"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, vpsOfferingSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.vpsOffering.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Paket VPS dengan slug "${parsed.data.slug}" sudah ada` })

  const { features, ...rest } = parsed.data
  const offering = await db.vpsOffering.create({
    data: { ...rest, features: toFeaturesJson(features) },
  })
  return NextResponse.json({ vpsOffering: offering }, { status: 201 })
})
