import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { workspacePlanSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"
import { isPricingRecordUsed, recordPricingChange } from "@/lib/billing/pricing-audit"

export const PATCH = withAdminAuth(async (request, context, { session }) => {
  const { id } = await context.params
  const parsed = await readJson(request, workspacePlanSchema.partial())
  if (!parsed.ok) return parsed.response

  return db.$transaction(async (tx) => {
    const existing = await tx.workspacePlan.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Plan tidak ditemukan" })

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      if (await isPricingRecordUsed(tx, "workspacePlan", existing)) {
        return apiError("conflict", { message: "Slug yang sudah digunakan tidak boleh diubah." })
      }
      const slugTaken = await tx.workspacePlan.findUnique({ where: { slug: parsed.data.slug } })
      if (slugTaken) return apiError("conflict", { message: `Plan dengan slug "${parsed.data.slug}" sudah ada` })
    }

    const plan = await tx.workspacePlan.update({ where: { id }, data: { ...parsed.data, features: toFeaturesJson(parsed.data.features) } })
    await recordPricingChange(tx, session.user.id, "workspacePlan", "updated", plan, existing)
    return NextResponse.json({ plan })
  })
}, { allowRoles: ["finance"] })

export const DELETE = withAdminAuth(async (_request, context, { session }) => {
  const { id } = await context.params
  return db.$transaction(async (tx) => {
    const existing = await tx.workspacePlan.findUnique({ where: { id } })
    if (!existing) return apiError("not_found", { message: "Plan tidak ditemukan" })

    if (await isPricingRecordUsed(tx, "workspacePlan", existing)) {
      return apiError("conflict", { message: "Paket sudah digunakan. Nonaktifkan paket untuk menghentikan penjualan baru." })
    }
    await tx.workspacePlan.delete({ where: { id } })
    await recordPricingChange(tx, session.user.id, "workspacePlan", "deleted", existing)
    return NextResponse.json({ success: true })
  }, { isolationLevel: "Serializable" })
}, { allowRoles: ["finance"] })
