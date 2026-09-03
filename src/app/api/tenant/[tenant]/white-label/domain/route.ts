import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { getRedis } from "@/lib/redis"
import { isFeatureEnabled, getTenantPlanConfig } from "@/lib/tenant-plan"
import {
  parseDomainInfo,
  getExpectedDnsRecords,
  diagnoseDomainDns,
  buildVerificationToken,
} from "@/lib/domain-dns"

const setDomainSchema = z.object({
  customDomain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      "Format nama domain tidak valid"
    ),
  target: z.enum(["cms", "workspace", "site", "api"]).optional().default("cms"),
})

const verifyOrDeleteSchema = z.object({
  customDomain: z.string().min(3),
})

const setPrimarySchema = z.object({
  customDomain: z.string().min(3),
  isPrimary: z.boolean(),
})

const updateTargetSchema = z.object({
  customDomain: z.string().min(3),
  target: z.enum(["cms", "workspace", "site", "api"]),
})

/**
 * GET /api/tenant/[tenant]/white-label/domain
 * Get current custom domains and their expected DNS records
 */
export const GET = withStaffAuth(
  async (request, _context, { access, session }) => {

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      include: {
        customDomains: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!tenantRecord) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const domains = tenantRecord.customDomains.map((d) => {
      const info = parseDomainInfo(d.domain)
      const expectedRecords = getExpectedDnsRecords(d.domain, access.tenantId)
      return {
        ...d,
        domainInfo: info,
        dnsRecords: expectedRecords,
        dnsVerification: expectedRecords.find((r) => r.type === "TXT") || {
          type: "TXT",
          name: info.isApex ? "_sacms-challenge" : `_sacms-challenge.${info.subdomainPrefix}`,
          value: buildVerificationToken(access.tenantId),
        },
      }
    })

    return NextResponse.json({ domains })
  },
  { minRole: "admin" },
)

/**
 * POST /api/tenant/[tenant]/white-label/domain
 * Add a new custom domain for the tenant
 */
export const POST = withStaffAuth(
  async (request, _context, { access, session }) => {

    if (!(await isFeatureEnabled(access.tenantId, "ENABLE_CUSTOM_DOMAIN"))) {
      return NextResponse.json(
        { error: "Fitur custom domain membutuhkan paket Pro, Enterprise, atau add-on aktif." },
        { status: 403 }
      )
    }

    const result = await validateBody(request, setDomainSchema)
    if ("error" in result) return result.error

    const customDomain = result.data.customDomain.toLowerCase().trim()

    const planConfig = await getTenantPlanConfig(access.tenantId)
    const currentDomainCount = await db.customDomain.count({
      where: { tenantId: access.tenantId },
    })

    const isSelfHost = process.env.SELFHOST_MODE === "true" || process.env.NODE_ENV === "development"
    const maxAllowed = isSelfHost ? 9999 : (planConfig.max_custom_domains || 25)

    if (currentDomainCount >= maxAllowed) {
      return NextResponse.json(
        {
          error: `Batas domain kustom tercapai (${maxAllowed} domain untuk paket Anda). Silakan upgrade paket untuk menambah domain.`,
        },
        { status: 403 }
      )
    }

    // Check if domain is already registered anywhere
    const existing = await db.customDomain.findUnique({
      where: { domain: customDomain },
      select: { tenantId: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: "Domain ini telah digunakan oleh workspace lain." },
        { status: 409 }
      )
    }

    const target = result.data.target || "cms"

    const newDomain = await db.customDomain.create({
      data: {
        tenantId: access.tenantId,
        domain: customDomain,
        status: "pending",
        isPrimary: currentDomainCount === 0,
        target,
      },
    })

    const expectedRecords = getExpectedDnsRecords(customDomain, access.tenantId)
    const info = parseDomainInfo(customDomain)

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
      domainInfo: info,
      dnsRecords: expectedRecords,
      dnsVerification: expectedRecords.find((r) => r.type === "TXT"),
    })
  },
  { minRole: "admin" },
)

/**
 * PUT /api/tenant/[tenant]/white-label/domain
 * Trigger live Vercel-style DNS diagnostics and verification for a domain
 */
export const PUT = withStaffAuth(
  async (request, _context, { access, session }) => {

    const result = await validateBody(request, verifyOrDeleteSchema)
    if ("error" in result) return result.error

    const { customDomain } = result.data

    const domainRecord = await db.customDomain.findUnique({
      where: { domain: customDomain },
    })

    if (!domainRecord || domainRecord.tenantId !== access.tenantId) {
      return NextResponse.json(
        { error: "Domain kustom tidak ditemukan atau Anda tidak memiliki akses." },
        { status: 404 }
      )
    }

    const tenantRecord = await db.tenant.findUnique({
      where: { id: access.tenantId },
      select: { slug: true },
    })

    // Perform live DNS diagnostics
    const diagnostics = await diagnoseDomainDns(customDomain, access.tenantId)

    const updatedDomain = await db.customDomain.update({
      where: { id: domainRecord.id },
      data: {
        status: diagnostics.verified ? "verified" : diagnostics.status === "invalid_configuration" ? "failed" : "pending",
        verifiedAt: diagnostics.verified ? new Date() : null,
      },
    })

    const redis = getRedis()
    if (diagnostics.verified && tenantRecord) {
      if (redis) {
        // Store JSON payload so proxy can read both slug AND portal target
        await redis.set(
          `domain:${customDomain}`,
          JSON.stringify({ slug: tenantRecord.slug, target: updatedDomain.target || "cms" })
        )
      }
    } else {
      if (redis) await redis.del(`domain:${customDomain}`)
    }

    return NextResponse.json({
      ...updatedDomain,
      diagnostics,
      verified: diagnostics.verified,
    })
  },
  { minRole: "admin" },
)

/**
 * PATCH /api/tenant/[tenant]/white-label/domain
 * Set primary domain for tenant OR update domain portal target
 */
export const PATCH = withStaffAuth(
  async (request, _context, { access, session }) => {

    const body = await request.json().catch(() => ({}))

    // If request includes "target" field — update domain portal routing target
    if ("target" in body) {
      const parsed = updateTargetSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
      }

      const { customDomain, target } = parsed.data
      const domainRecord = await db.customDomain.findUnique({ where: { domain: customDomain } })
      if (!domainRecord || domainRecord.tenantId !== access.tenantId) {
        return NextResponse.json({ error: "Domain tidak ditemukan." }, { status: 404 })
      }

      const updated = await db.customDomain.update({
        where: { id: domainRecord.id },
        data: { target },
      })

      // Update Redis cache if domain is verified
      if (domainRecord.status === "verified") {
        const redis = getRedis()
        const tenantRecord = await db.tenant.findUnique({
          where: { id: access.tenantId },
          select: { slug: true },
        })
        if (redis && tenantRecord) {
          await redis.set(
            `domain:${customDomain}`,
            JSON.stringify({ slug: tenantRecord.slug, target })
          )
        }
      }

      logAudit({
        tenantId: access.tenantId,
        userId: session.user.id,
        action: AuditAction.SETTINGS_UPDATED,
        entity: "tenant_custom_domain",
        entityId: domainRecord.id,
        data: { action: "update_target", domain: customDomain, target },
      })

      return NextResponse.json({ success: true, domain: updated })
    }

    // Default: set primary domain
    const result = await validateBody(
      new Request(request.url, { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
      setPrimarySchema
    )
    if ("error" in result) return result.error

    const { customDomain, isPrimary } = result.data

    if (isPrimary) {
      // Unset previous primary domains
      await db.customDomain.updateMany({
        where: { tenantId: access.tenantId },
        data: { isPrimary: false },
      })
    }

    const updated = await db.customDomain.update({
      where: { domain: customDomain },
      data: { isPrimary },
    })

    return NextResponse.json({ success: true, domain: updated })
  },
  { minRole: "admin" },
)

/**
 * DELETE /api/tenant/[tenant]/white-label/domain
 * Remove a custom domain
 */
export const DELETE = withStaffAuth(
  async (request, _context, { access, session }) => {

    const result = await validateBody(request, verifyOrDeleteSchema)
    if ("error" in result) return result.error

    const { customDomain } = result.data

    const domainRecord = await db.customDomain.findUnique({
      where: { domain: customDomain },
    })

    if (!domainRecord || domainRecord.tenantId !== access.tenantId) {
      return NextResponse.json(
        { error: "Domain kustom tidak ditemukan atau Anda tidak memiliki akses." },
        { status: 404 }
      )
    }

    await db.customDomain.delete({
      where: { id: domainRecord.id },
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
  },
  { minRole: "admin" },
)
