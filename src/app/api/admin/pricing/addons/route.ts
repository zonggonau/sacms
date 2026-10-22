import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { addonSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

// amountUnits is a BigInt column (byte counts up to ~1TB) — JSON.stringify
// throws on a raw BigInt, so every response serializes it to a plain
// number first. Safe here: the largest real value (1TB in bytes) is well
// under Number.MAX_SAFE_INTEGER.
function serializeAddon(addon: any) {
  return { ...addon, amountUnits: addon.amountUnits === null ? null : Number(addon.amountUnits) }
}

export const GET = withAdminAuth(async () => {
  const addons = await db.addon.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json({ addons: addons.map(serializeAddon) })
}, { allowRoles: ["admin"] })

export const POST = withAdminAuth(async (request) => {
  const parsed = await readJson(request, addonSchema)
  if (!parsed.ok) return parsed.response

  const existing = await db.addon.findUnique({ where: { slug: parsed.data.slug } })
  if (existing) return apiError("conflict", { message: `Addon dengan slug "${parsed.data.slug}" sudah ada` })

  const { amountUnits, features, ...rest } = parsed.data
  const addon = await db.addon.create({
    data: {
      ...rest,
      amountUnits: amountUnits !== undefined && amountUnits !== null ? BigInt(amountUnits) : null,
      features: toFeaturesJson(features),
    },
  })
  return NextResponse.json({ addon: serializeAddon(addon) }, { status: 201 })
})
