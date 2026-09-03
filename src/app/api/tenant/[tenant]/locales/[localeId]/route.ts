import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/database"
import { withStaffAuth, apiError, readJson } from "@/lib/api/route-helpers"

/** DELETE /api/tenant/[tenant]/locales/[localeId] — remove a locale (not the default). */
export const DELETE = withStaffAuth(
  async (_request, context, { access }) => {
    const { localeId } = await context.params
    const locale = await db.tenantLocale.findFirst({ where: { id: localeId, tenantId: access.tenantId } })
    if (!locale) return apiError("not_found", { message: "Locale not found" })
    if (locale.isDefault) {
      return apiError("validation", {
        message: "Cannot delete the default locale. Set another locale as default first.",
      })
    }

    await db.tenantLocale.delete({ where: { id: localeId } })
    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)

const PatchSchema = z.object({ isDefault: z.boolean().optional() })

/** PATCH /api/tenant/[tenant]/locales/[localeId] — update a locale (e.g. set default). */
export const PATCH = withStaffAuth(
  async (request, context, { access }) => {
    const { localeId } = await context.params
    const body = await readJson(request, PatchSchema)
    if (!body.ok) return body.response

    const locale = await db.tenantLocale.findFirst({ where: { id: localeId, tenantId: access.tenantId } })
    if (!locale) return apiError("not_found", { message: "Locale not found" })

    if (body.data.isDefault) {
      await db.tenantLocale.updateMany({
        where: { tenantId: access.tenantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const updated = await db.tenantLocale.update({
      where: { id: localeId },
      data: { isDefault: body.data.isDefault ?? locale.isDefault },
    })
    return NextResponse.json({ locale: updated })
  },
  { minRole: "admin" },
)
