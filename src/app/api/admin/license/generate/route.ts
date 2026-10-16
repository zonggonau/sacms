/**
 * POST /api/admin/license/generate
 * Generate a new enterprise license key (admin only)
 */
import crypto from "crypto"
import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { generateLicenseKey } from "@/lib/license"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withAdminAuth(
  async (request, _context, { session }) => {
    const body = await request.json()
    const { customerName, customerEmail, organization, type = "enterprise", expiresAt, features, storageGb, aiCredits } = body

    if (!customerName || !expiresAt) {
      return apiError("validation", { message: "customerName and expiresAt are required" })
    }

    const expDate = new Date(expiresAt)
    // Account-level pooled storage / AI-credit grants — see schema.prisma's
    // EnterpriseLicense.storageGb/aiCredits and plan-enforcement.ts's
    // getOwnerStorageLicense()/getUserAiCreditLicense(). Optional: a plain
    // self-hosted/partner/trial license doesn't need either.
    const storageGbValue: number | undefined =
      storageGb === undefined || storageGb === null || storageGb === "" ? undefined : Number(storageGb)
    const aiCreditsValue: number | undefined =
      aiCredits === undefined || aiCredits === null || aiCredits === "" ? undefined : Number(aiCredits)

    // Generate license key
    const licenseKey = generateLicenseKey({
      sub: `ent_${crypto.randomUUID().slice(0, 8)}`,
      name: customerName,
      email: customerEmail,
      org: organization,
      type: type as "enterprise" | "partner" | "trial",
      features: features || ["self-host", "unlimited-workspaces"],
      storageGb: storageGbValue,
      aiCredits: aiCreditsValue,
      exp: Math.floor(expDate.getTime() / 1000),
    })

    // Store in DB
    const license = await db.enterpriseLicense.create({
      data: {
        licenseKey,
        customerName,
        customerEmail,
        organization,
        type,
        features: features || ["self-host", "unlimited-workspaces"],
        storageGb: storageGbValue ?? null,
        aiCredits: aiCreditsValue ?? null,
        expiresAt: expDate,
        createdBy: session.user.email,
      },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "EnterpriseLicenseGenerated",
      entityId: license.id,
      data: { customerName, customerEmail, organization, type, storageGb: storageGbValue, aiCredits: aiCreditsValue, expiresAt: expDate.toISOString() },
    })

    return NextResponse.json({
      id: license.id,
      licenseKey,
      customerName: license.customerName,
      customerEmail: license.customerEmail,
      type: license.type,
      storageGb: license.storageGb,
      aiCredits: license.aiCredits,
      expiresAt: license.expiresAt,
    })
  },
)
