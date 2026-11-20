import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { addonSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { isPricingRecordUsed, recordPricingChange } from "@/lib/billing/pricing-audit"

// See route.ts — amountUnits is BigInt in the DB, serialized to a plain
// number for JSON (safe up to ~9×10^15, real values top out around 1TB).
function serializeAddon(addon: any) {
  return { ...addon, amountUnits: addon.amountUnits === null ? null : Number(addon.amountUnits) }
}

export const PATCH = withAdminAuth(async (request, context, { session }) => {
  const { id } = await context.params
  const parsed = await readJson(request, addonSchema.partial())
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.addon.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Addon tidak ditemukan" })

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      if (await isPricingRecordUsed(tx, "addon", existing)) {
        return apiError("conflict", { message: "Slug yang sudah digunakan tidak boleh diubah." })
      }
      const slugTaken = await tx.addon.findUnique({ where: { slug: parsed.data.slug } })
      if (slugTaken) return apiError("conflict", { message: `Addon dengan slug "${parsed.data.slug}" sudah ada` })
    }

    const { amountUnits, features, ...rest } = parsed.data
    const addon = await tx.addon.update({
      where: { id },
      data: {
        ...rest,
        ...(amountUnits !== undefined ? { amountUnits: amountUnits === null ? null : BigInt(amountUnits) } : {}),
        features: toFeaturesJson(features),
      },
    })
    await recordPricingChange(tx, session.user.id, "addon", "updated", addon, existing)
    return NextResponse.json({ addon: serializeAddon(addon) })
  })
}, { allowRoles: ["finance"] })

export const DELETE = withAdminAuth(async (_request, context, { session }) => {
  const { id } = await context.params
  return db.$transaction(async (tx) => {
    const existing = await tx.addon.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Addon tidak ditemukan" })

    if (await isPricingRecordUsed(tx, "addon", existing)) {
      return apiError("conflict", { message: "Paket sudah digunakan. Nonaktifkan paket untuk menghentikan penjualan baru." })
    }
    await tx.addon.delete({ where: { id } })
    await recordPricingChange(tx, session.user.id, "addon", "deleted", existing)
    return NextResponse.json({ success: true })
  }, { isolationLevel: "Serializable" })
}, { allowRoles: ["finance"] })
