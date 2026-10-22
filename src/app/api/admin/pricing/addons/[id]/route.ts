import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { addonSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

// See route.ts — amountUnits is BigInt in the DB, serialized to a plain
// number for JSON (safe up to ~9×10^15, real values top out around 1TB).
function serializeAddon(addon: any) {
  return { ...addon, amountUnits: addon.amountUnits === null ? null : Number(addon.amountUnits) }
}

export const PATCH = withAdminAuth(async (request, context) => {
  const { id } = await context.params
  const parsed = await readJson(request, addonSchema.partial())
  if (!parsed.ok) return parsed.response

  const existing = await db.addon.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Addon tidak ditemukan" })

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugTaken = await db.addon.findUnique({ where: { slug: parsed.data.slug } })
    if (slugTaken) return apiError("conflict", { message: `Addon dengan slug "${parsed.data.slug}" sudah ada` })
  }

  const { amountUnits, features, ...rest } = parsed.data
  const addon = await db.addon.update({
    where: { id },
    data: {
      ...rest,
      ...(amountUnits !== undefined ? { amountUnits: amountUnits === null ? null : BigInt(amountUnits) } : {}),
      features: toFeaturesJson(features),
    },
  })
  return NextResponse.json({ addon: serializeAddon(addon) })
})

export const DELETE = withAdminAuth(async (_request, context) => {
  const { id } = await context.params
  const existing = await db.addon.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Addon tidak ditemukan" })

  await db.addon.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
