import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { resolveTxt } from "dns/promises"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getRedis } from "@/lib/redis"
import { isFeatureEnabled, getTenantPlanConfig } from "@/lib/tenant-plan"

const setDomainSchema = z.object({
  customDomain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      "Invalid domain format"
    ),
})

const verifyOrDeleteSchema = z.object({
  customDomain: z.string().min(3),
})

/**
 * GET /api/tenant/[tenant]/white-label/domain
 * Get current custom domains and DNS verification records
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
    if (!access || !["owner", "admin"].includes(access.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!await isFeatureEnabled(access.tenantId, "ENABLE_CUSTOM_DOMAIN")) {
      return NextResponse.json({ error: "Custom domain requires a Pro, Enterprise, or Custom plan" }, { status: 403 })
    }

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      include: {
        customDomains: {
          orderBy: { createdAt: 'desc' }
        }
      },
    })

    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const verificationToken = buildVerificationToken(access.tenantId)

    const domains = tenantRecord.customDomains.map(d => ({
      ...d,
      dnsVerification: {
        type: "TXT",
        name: `_sacms-verify.${d.domain}`,
        value: verificationToken,
      }
    }))

    return NextResponse.json({
      domains,
    })
  } catch (error) {
    console.error("Error fetching custom domains:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/white-label/domain
 * Add a new custom domain for the tenant
 */
export async function POST(
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

    if (!await isFeatureEnabled(access.tenantId, "ENABLE_CUSTOM_DOMAIN")) {
      return NextResponse.json({ error: "Custom domain requires a Pro, Enterprise, or Custom plan" }, { status: 403 })
    }

    const result = await validateBody(request, setDomainSchema)
    if ("error" in result) return result.error

    const customDomain = result.data.customDomain.toLowerCase()

    const planConfig = await getTenantPlanConfig(access.tenantId)
    const currentDomainCount = await db.customDomain.count({
      where: { tenantId: access.tenantId }
    })

    if (currentDomainCount >= planConfig.max_custom_domains) {
      return NextResponse.json(
        { error: `You have reached the limit of ${planConfig.max_custom_domains} custom domains for your plan.` },
        { status: 403 }
      )
    }

    // Check no other tenant already owns this domain
    const existing = await db.customDomain.findUnique({
      where: { domain: customDomain },
      select: { tenantId: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "This domain is already in use by another tenant" },
        { status: 409 }
      )
    }

    const newDomain = await db.customDomain.create({
      data: {
        tenantId: access.tenantId,
        domain: customDomain,
        status: "pending",
        isPrimary: currentDomainCount === 0, // Make primary if it's the first one
      }
    })

    const verificationToken = buildVerificationToken(access.tenantId)

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "tenant_custom_domain",
      entityId: newDomain.id,
      data: { action: "add", domain: customDomain },
    })

    return NextResponse.json({
      ...newDomain,
      dnsVerification: {
        type: "TXT",
        name: `_sacms-verify.${customDomain}`,
        value: verificationToken,
      },
    })
  } catch (error) {
    console.error("Error setting custom domain:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/tenant/[tenant]/white-label/domain
 * Trigger DNS verification for a specific custom domain
 */
export async function PUT(
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

    const result = await validateBody(request, verifyOrDeleteSchema)
    if ("error" in result) return result.error

    const { customDomain } = result.data

    const domainRecord = await db.customDomain.findUnique({
      where: { domain: customDomain },
    })

    if (!domainRecord || domainRecord.tenantId !== access.tenantId) {
      return NextResponse.json(
        { error: "Custom domain not found or you don't have access" },
        { status: 404 }
      )
    }

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      select: { slug: true }
    })

    const expectedToken = buildVerificationToken(access.tenantId)
    const verified = await verifyDnsTxt(customDomain, expectedToken)

    const updatedDomain = await db.customDomain.update({
      where: { id: domainRecord.id },
      data: {
        status: verified ? "verified" : "failed",
        verifiedAt: verified ? new Date() : null,
      },
    })

    if (verified && tenantRecord) {
      const redis = getRedis()
      if (redis) {
        await redis.set(`domain:${customDomain}`, tenantRecord.slug)
      }
    } else {
      const redis = getRedis()
      if (redis) await redis.del(`domain:${customDomain}`)
    }

    if (!verified) {
      return NextResponse.json(
        {
          verified: false,
          error: "DNS TXT record not found. Please add the verification record and try again.",
          dnsVerification: {
            type: "TXT",
            name: `_sacms-verify.${customDomain}`,
            value: expectedToken,
          },
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      verified: true,
      ...updatedDomain,
    })
  } catch (error) {
    console.error("Error verifying custom domain:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/tenant/[tenant]/white-label/domain
 * Remove a custom domain
 */
export async function DELETE(
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

    const result = await validateBody(request, verifyOrDeleteSchema)
    if ("error" in result) return result.error

    const { customDomain } = result.data

    const domainRecord = await db.customDomain.findUnique({
      where: { domain: customDomain },
    })

    if (!domainRecord || domainRecord.tenantId !== access.tenantId) {
      return NextResponse.json(
        { error: "Custom domain not found or you don't have access" },
        { status: 404 }
      )
    }

    await db.customDomain.delete({
      where: { id: domainRecord.id }
    })

    const redis = getRedis()
    if (redis) await redis.del(`domain:${customDomain}`)

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "tenant_custom_domain",
      entityId: domainRecord.id,
      data: { action: "delete", domain: customDomain },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting custom domain:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ==================== HELPERS ====================

/**
 * Build a deterministic verification token for a tenant.
 * Uses tenantId + a server-side secret so it can't be forged.
 */
function buildVerificationToken(tenantId: string): string {
  const secret = process.env.NEXTAUTH_SECRET || "sacms-domain-verify"
  // Simple deterministic token: no crypto needed for DNS TXT records
  return `sacms-verify=${Buffer.from(`${tenantId}:${secret}`)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32)}`
}

/**
 * Check if a DNS TXT record exists under \`_sacms-verify.<domain>\`.
 */
async function verifyDnsTxt(domain: string, expectedValue: string): Promise<boolean> {
  try {
    const records = await resolveTxt(`_sacms-verify.${domain}`)
    // records is string[][] — flatten and check
    return records.flat().some((r) => r === expectedValue)
  } catch {
    return false
  }
}
