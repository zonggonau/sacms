import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { randomBytes } from "crypto"
import { slugify } from "@/lib/slug"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { assertPublicHost, SsrfError } from "@/lib/safe-url"

const MASK = "••••••••"

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  plan: z.string().optional(),
  status: z.string().optional(),
  databaseUrl: z.string().optional().or(z.literal("")),
})

/**
 * Generate a unique slug based on name (iterative, max 10 attempts)
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = slugify(name) || "workspace"
  let slug = baseSlug
  
  for (let attempt = 0; attempt < 10; attempt++) {
    const existing = await db.tenant.findUnique({ where: { slug } })
    if (!existing) return slug
    
    const suffix = randomBytes(3).toString("hex")
    slug = `${baseSlug}-${suffix}`
  }
  
  throw new Error(`Could not generate unique slug for "${name}" after 10 attempts`)
}

export const GET = withAdminAuth(async (request) => {
    const { searchParams } = request.nextUrl
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "10")
    const search = searchParams.get("search") || ""
    const sort = searchParams.get("sort") || "createdAt:desc"

    const [sortField, sortOrder] = sort.split(":")
    const validSortFields = ["createdAt", "name", "plan", "status"]
    const orderBy: any = validSortFields.includes(sortField) 
      ? { [sortField]: sortOrder === "asc" ? "asc" : "desc" }
      : { createdAt: "desc" }

    const where = search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    } : {}

    const skip = (page - 1) * limit

    const [tenants, total] = await Promise.all([
      db.tenant.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          plan: true,
          databaseUrl: true,
          description: true,
          logo: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true,
              contentTypeAssignments: true,
              singleTypeAssignments: true,
              componentAssignments: true,
              media: true,
              apiTokens: true,
            },
          },
          apiTokens: {
            select: {
              id: true,
              type: true,
              expiresAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          subscriptions: {
            where: { status: "active" },
            select: {
              id: true,
              plan: true,
              status: true,
              currentPeriodEnd: true,
              invoices: {
                select: {
                  id: true,
                  amount: true,
                  status: true,
                  paidAt: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
            take: 1,
          },
          members: {
            select: {
              user: {
                select: { id: true, name: true, email: true },
              },
              role: true,
            },
            where: { role: "owner" },
            take: 1,
          },
        },
        orderBy,
      }),
      db.tenant.count({ where })
    ])

    // databaseUrl is a full Postgres connection string including the
    // password — it used to go out raw in this bulk list response (visible
    // in the Network tab for every row with a dedicated DB) before the
    // admin ever opened a single tenant's edit modal. Masked here; the
    // real value is only ever revealed one tenant at a time via GET
    // /api/admin/tenants/[tenantId]?reveal=databaseUrl (audited).
    const safeTenants = tenants.map((t) => ({ ...t, databaseUrl: t.databaseUrl ? MASK : null }))

    return NextResponse.json({ tenants: safeTenants, total, page, totalPages: Math.ceil(total / limit) })
})

export const POST = withAdminAuth(async (request, _context, { session }) => {
    const result = await validateBody(request, createTenantSchema)
    if ("error" in result) return result.error
    const { name, description, plan, status, databaseUrl } = result.data

    // Same SSRF guard as the PATCH route below — this value is used to
    // open a real server-side Postgres connection for this tenant on every
    // request it makes (src/lib/database.ts's acquireTenantClient).
    if (databaseUrl) {
      let parsedDbUrl: URL
      try {
        parsedDbUrl = new URL(databaseUrl)
      } catch {
        return apiError("validation", { message: "Invalid database URL" })
      }
      if (!["postgres:", "postgresql:"].includes(parsedDbUrl.protocol)) {
        return apiError("validation", { message: "Database URL must use the postgres:// or postgresql:// scheme" })
      }
      try {
        await assertPublicHost(parsedDbUrl.hostname)
      } catch (e) {
        return apiError("validation", { message: e instanceof SsrfError ? `Database URL rejected: ${e.message}` : "Invalid database URL" })
      }
    }

    // 1. Auto-generate unique slug based on name
    const slug = await generateUniqueSlug(name)

    // 2. Create tenant and initial subscription in transaction
    const tenant = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          description: description || null,
          plan: plan || "starter",
          status: status || "active",
          databaseUrl: databaseUrl || null,
        },
      })

      // Create subscription with 7-day trial
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      await tx.subscription.create({
        data: {
          userId: session.user.id, // Assigned to the admin who created it
          tenantId: newTenant.id,
          plan: plan || "starter",
          status: "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: trialEndDate,
        },
      })

      // Create default API key using ApiToken
      const { randomBytes, createHash } = await import("crypto")
      const plainToken = `cf_${randomBytes(32).toString("hex")}`
      const hashedToken = createHash("sha256").update(plainToken).digest("hex")

      await tx.apiToken.create({
        data: {
          tenantId: newTenant.id,
          name: "Default API Key",
          token: hashedToken,
          type: "full-access",
          permissions: ["read", "write", "delete"],
          createdBy: session.user.id,
        }
      })

      return newTenant
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_CREATED,
      entity: "Tenant",
      entityId: tenant.id,
      data: { name: tenant.name, slug: tenant.slug, plan: tenant.plan, status: tenant.status, createdByAdmin: true },
    })

    return NextResponse.json({ tenant })
})
