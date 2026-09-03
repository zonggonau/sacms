import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withStaffAuth } from "@/lib/api/route-helpers"

const whiteLabelSchema = z.object({
  brandName: z.string().min(1).max(100).optional(),
  brandLogo: z.url().optional().or(z.literal("")),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color (e.g. #3B82F6)")
    .optional()
    .or(z.literal("")),
  customEmailSender: z.email().optional().or(z.literal("")),
  faviconUrl: z.url().optional().or(z.literal("")),
})

/** GET /api/tenant/[tenant]/white-label — branding + custom-domain state. */
export const GET = withStaffAuth(async (_request, _context, { access }) => {
  const tenantRecord = await db.tenant.findUnique({
    where: { id: access.tenantId },
    select: {
      customDomain: true,
      customDomainStatus: true,
      customDomainVerifiedAt: true,
      brandName: true,
      brandLogo: true,
      primaryColor: true,
      customEmailSender: true,
      faviconUrl: true,
    },
  })
  return NextResponse.json(tenantRecord || {})
})

/** PATCH /api/tenant/[tenant]/white-label — update branding (admin/owner only). */
export const PATCH = withStaffAuth(
  async (request, _context, { access, session }) => {
    const result = await validateBody(request, whiteLabelSchema)
    if ("error" in result) return result.error

    const data = Object.fromEntries(
      Object.entries(result.data).map(([k, v]) => [k, v === "" ? null : v]),
    )

    const updated = await db.tenant.update({
      where: { id: access.tenantId },
      data,
      select: {
        brandName: true,
        brandLogo: true,
        primaryColor: true,
        customEmailSender: true,
        faviconUrl: true,
        customDomain: true,
        customDomainStatus: true,
      },
    })

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "tenant_white_label",
      entityId: access.tenantId,
      data,
    })

    return NextResponse.json(updated)
  },
  { minRole: "admin" },
)
