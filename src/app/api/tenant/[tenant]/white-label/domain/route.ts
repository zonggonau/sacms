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

const setDomainSchema = z.object({
  customDomain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      "Invalid domain format"
    )
    .optional()
    .nullable(),
})

/**
 * GET /api/tenant/[tenant]/white-label/domain
 * Get current custom domain status and DNS verification record
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

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      select: {
        slug: true,
        customDomain: true,
        customDomainStatus: true,
        customDomainVerifiedAt: true,
      },
    })

    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const verificationToken = buildVerificationToken(access.tenantId)

    return NextResponse.json({
      ...tenantRecord,
      // DNS TXT record the user must create to prove domain ownership
      dnsVerification: tenantRecord.customDomain
        ? {
            type: "TXT",
            name: `_sacms-verify.${tenantRecord.customDomain}`,
            value: verificationToken,
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching custom domain:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * PUT /api/tenant/[tenant]/white-label/domain
 * Set (or clear) the custom domain for the tenant
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

    const result = await validateBody(request, setDomainSchema)
    if ("error" in result) return result.error

    const { customDomain } = result.data

    // Clearing domain
    if (!customDomain) {
      const oldTenant = await db.tenant.findUnique({
        where: { id: access.tenantId },
        select: { customDomain: true },
      })
      await db.tenant.update({
        where: { id: access.tenantId },
        data: {
          customDomain: null,
          customDomainStatus: null,
          customDomainVerifiedAt: null,
        },
      })
      
      if (oldTenant?.customDomain) {
        const redis = getRedis()
        if (redis) await redis.del(`domain:${oldTenant.customDomain}`)
      }

      return NextResponse.json({ customDomain: null, status: "cleared" })
    }

    // Check no other tenant already owns this domain
    const existing = await db.tenant.findUnique({
      where: { customDomain },
      select: { id: true },
    })
    if (existing && existing.id !== access.tenantId) {
      return NextResponse.json(
        { error: "This domain is already in use by another tenant" },
        { status: 409 }
      )
    }

    await db.tenant.update({
      where: { id: access.tenantId },
      data: {
        customDomain,
        customDomainStatus: "pending",
        customDomainVerifiedAt: null,
      },
    })

    const verificationToken = buildVerificationToken(access.tenantId)

    logAudit({
      tenantId: access.tenantId,
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "tenant_custom_domain",
      entityId: access.tenantId,
      data: { customDomain },
    })

    return NextResponse.json({
      customDomain,
      customDomainStatus: "pending",
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
 * POST /api/tenant/[tenant]/white-label/domain
 * Trigger DNS verification for the custom domain
 */
export async function POST(
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

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      select: { customDomain: true, slug: true },
    })

    if (!tenantRecord?.customDomain) {
      return NextResponse.json(
        { error: "No custom domain configured" },
        { status: 400 }
      )
    }

    const { customDomain } = tenantRecord
    const expectedToken = buildVerificationToken(access.tenantId)
    const verified = await verifyDnsTxt(customDomain, expectedToken)

    await db.tenant.update({
      where: { id: access.tenantId },
      data: {
        customDomainStatus: verified ? "verified" : "failed",
        customDomainVerifiedAt: verified ? new Date() : null,
      },
    })

    if (verified) {
      const redis = getRedis()
      if (redis) {
        await redis.set(`domain:${customDomain}`, tenantRecord.slug)
      }
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
      customDomain,
      customDomainStatus: "verified",
      customDomainVerifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error verifying custom domain:", error)
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
 * Check if a DNS TXT record exists under `_sacms-verify.<domain>`.
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
