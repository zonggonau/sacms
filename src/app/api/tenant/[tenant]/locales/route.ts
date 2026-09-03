import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { addLocaleSchema } from "@/lib/validations"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

/** GET /api/tenant/[tenant]/locales — list locales + the plan's locale limit. */
export const GET = withStaffAuth(async (_request, _context, { access, session }) => {
  const locales = await db.tenantLocale.findMany({
    where: { tenantId: access.tenantId },
    orderBy: [{ isDefault: "desc" }, { locale: "asc" }],
  })

  const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
  const enforcement = await enforcePlanLimit(access.tenantId, "locales", session.user.id)

  return NextResponse.json({
    locales,
    limit: enforcement.max,
    current: enforcement.current,
    isLimitReached: enforcement.current >= enforcement.max,
  })
})

/** POST /api/tenant/[tenant]/locales — add a locale (admin/owner only). */
export const POST = withStaffAuth(
  async (request, _context, { access, session }) => {
    const result = await validateBody(request, addLocaleSchema)
    if ("error" in result) return result.error
    const { locale, name, isDefault } = result.data

    const { enforcePlanLimit } = await import("@/lib/plan-enforcement")
    const enforcement = await enforcePlanLimit(access.tenantId, "locales", session.user.id)
    if (!enforcement.allowed) {
      return apiError("plan_limit", {
        message: enforcement.message,
        details: { current: enforcement.current, max: enforcement.max, plan: enforcement.planSlug },
      })
    }

    if (isDefault) {
      await db.tenantLocale.updateMany({
        where: { tenantId: access.tenantId, isDefault: true },
        data: { isDefault: false },
      })
    }

    try {
      const tenantLocale = await db.tenantLocale.create({
        data: {
          tenantId: access.tenantId,
          locale,
          name,
          isDefault: isDefault || enforcement.current === 0,
        },
      })
      return NextResponse.json({ locale: tenantLocale }, { status: 201 })
    } catch (error: any) {
      if (error?.code === "P2002") {
        return apiError("conflict", { message: "Locale already exists for this workspace" })
      }
      throw error
    }
  },
  { minRole: "admin" },
)
