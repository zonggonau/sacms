import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { aiCreditPackSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { isPricingRecordUsed, recordPricingChange } from "@/lib/billing/pricing-audit"

export const PATCH = withAdminAuth(async (request, context, { session }) => {
  const { id } = await context.params
  const parsed = await readJson(request, aiCreditPackSchema.partial())
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.aiCreditPack.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Paket tidak ditemukan" })

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      if (await isPricingRecordUsed(tx, "aiCreditPack", existing)) {
        return apiError("conflict", { message: "Slug yang sudah digunakan tidak boleh diubah." })
      }
      const slugTaken = await tx.aiCreditPack.findUnique({ where: { slug: parsed.data.slug } })
      if (slugTaken) return apiError("conflict", { message: `Paket dengan slug "${parsed.data.slug}" sudah ada` })
    }

    const pack = await tx.aiCreditPack.update({ where: { id }, data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
    await recordPricingChange(tx, session.user.id, "aiCreditPack", "updated", pack, existing)
    return NextResponse.json({ pack })
  })
}, { allowRoles: ["finance"] })

export const DELETE = withAdminAuth(async (_request, context, { session }) => {
  const { id } = await context.params
  return db.$transaction(async (tx) => {
    const existing = await tx.aiCreditPack.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Paket tidak ditemukan" })

    if (await isPricingRecordUsed(tx, "aiCreditPack", existing)) {
      return apiError("conflict", { message: "Paket sudah digunakan. Nonaktifkan paket untuk menghentikan penjualan baru." })
    }
    await tx.aiCreditPack.delete({ where: { id } })
    await recordPricingChange(tx, session.user.id, "aiCreditPack", "deleted", existing)
    return NextResponse.json({ success: true })
  }, { isolationLevel: "Serializable" })
}, { allowRoles: ["finance"] })
