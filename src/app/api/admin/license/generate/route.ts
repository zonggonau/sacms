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
    const { customerName, customerEmail, organization, type = "enterprise", expiresAt, features, storageGb, aiCredits, maxInstances, maxWorkspaces, priceIdr } = body

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
    // How many distinct accounts may activate this key — see
    // EnterpriseLicense.maxInstances and POST /api/user/license/activate.
    // Defaults to the schema's own default (1) when omitted.
    const maxInstancesValue: number | undefined =
      maxInstances === undefined || maxInstances === null || maxInstances === ""
        ? undefined
        : Math.max(1, Math.floor(Number(maxInstances)))
    // Workspace-count entitlement — see schema.prisma's
    // EnterpriseLicense.maxWorkspaces and plan-enforcement.ts's
    // getUserWorkspaceLicense(). undefined = this license doesn't touch
    // workspace limits at all (e.g. a storage/AI-credit-only license).
    const maxWorkspacesValue: number | undefined =
      maxWorkspaces === undefined || maxWorkspaces === null || maxWorkspaces === ""
        ? undefined
        : Math.max(1, Math.floor(Number(maxWorkspaces)))
    // Contract value in IDR — sales record only, never consulted by
    // validateLicense()/enforcement. Admin-entered (auto-suggested by the
    // UI's calculator, editable before submit).
    const priceIdrValue: number | undefined =
      priceIdr === undefined || priceIdr === null || priceIdr === ""
        ? undefined
        : Math.max(0, Math.floor(Number(priceIdr)))

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
      maxWorkspaces: maxWorkspacesValue,
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
        maxWorkspaces: maxWorkspacesValue ?? null,
        priceIdr: priceIdrValue ?? null,
        ...(maxInstancesValue !== undefined ? { maxInstances: maxInstancesValue } : {}),
        expiresAt: expDate,
        createdBy: session.user.email,
      },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "EnterpriseLicenseGenerated",
      entityId: license.id,
      data: { customerName, customerEmail, organization, type, storageGb: storageGbValue, aiCredits: aiCreditsValue, maxWorkspaces: maxWorkspacesValue, priceIdr: priceIdrValue, maxInstances: license.maxInstances, expiresAt: expDate.toISOString() },
    })

    return NextResponse.json({
      id: license.id,
      licenseKey,
      customerName: license.customerName,
      customerEmail: license.customerEmail,
      type: license.type,
      storageGb: license.storageGb,
      aiCredits: license.aiCredits,
      maxWorkspaces: license.maxWorkspaces,
      priceIdr: license.priceIdr,
      maxInstances: license.maxInstances,
      expiresAt: license.expiresAt,
    })
  },
)
