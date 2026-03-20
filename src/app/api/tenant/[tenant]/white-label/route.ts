import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { logAudit, AuditAction } from "@/lib/audit-log"

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

/**
 * GET /api/tenant/[tenant]/white-label
 * Get white-label settings for the tenant
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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

    return NextResponse.json(tenantRecord)
  } catch (error) {
    console.error("Error fetching white-label settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PATCH /api/tenant/[tenant]/white-label
 * Update branding settings (owner/admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant } = await params
    const access = await getTenantAccess(session, tenant)
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await validateBody(request, whiteLabelSchema)
    if ("error" in result) return result.error

    // Normalize empty strings to null
    const data = Object.fromEntries(
      Object.entries(result.data).map(([k, v]) => [k, v === "" ? null : v])
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
  } catch (error) {
    console.error("Error updating white-label settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
