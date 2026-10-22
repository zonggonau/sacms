import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"
import { vpsOfferingSchema } from "@/lib/validations/pricing"
import { toFeaturesJson } from "@/lib/pricing"

export const PATCH = withAdminAuth(async (request, context) => {
  const { id } = await context.params
  const parsed = await readJson(request, vpsOfferingSchema.partial())
  if (!parsed.ok) return parsed.response

  const existing = await db.vpsOffering.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Paket VPS tidak ditemukan" })

  if (parsed.data.slug && parsed.data.slug !== existing.slug) {
    const slugTaken = await db.vpsOffering.findUnique({ where: { slug: parsed.data.slug } })
    if (slugTaken) return apiError("conflict", { message: `Paket VPS dengan slug "${parsed.data.slug}" sudah ada` })
  }

  const { features, ...rest } = parsed.data
  const offering = await db.vpsOffering.update({
    where: { id },
    data: { ...rest, features: toFeaturesJson(features) },
  })
  return NextResponse.json({ vpsOffering: offering })
})

export const DELETE = withAdminAuth(async (_request, context) => {
  const { id } = await context.params
  const existing = await db.vpsOffering.findUnique({ where: { id } })
  if (!existing) return apiError("not_found", { message: "Paket VPS tidak ditemukan" })

  try {
    await db.vpsOffering.delete({ where: { id } })
  } catch {
    // FK restrict: at least one VpsInstance still references this offering
    // (purchase history must never be allowed to dangle) — deactivate
    // instead of deleting so it stops being sold without losing the trail.
    return apiError("conflict", {
      message: "Paket VPS ini sudah pernah dibeli dan tidak bisa dihapus — nonaktifkan saja agar tidak dijual lagi.",
    })
  }
  return NextResponse.json({ success: true })
})
