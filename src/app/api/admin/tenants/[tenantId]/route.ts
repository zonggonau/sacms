import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { deleteTenantStorage } from "@/lib/r2"
import { dropEnterpriseDb } from "@/lib/enterprise-db"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { assertPublicHost, SsrfError } from "@/lib/safe-url"

const MASK = "••••••••"

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
  description: z.string().max(500).optional().nullable(),
  databaseUrl: z.string().optional().or(z.literal("")).nullable(),
})

/** Same global-tenant heuristic used client-side (tenant-table.tsx) and by DELETE below. */
function isGlobalTenant(tenant: { id: string; slug: string; name: string }): boolean {
  return (
    tenant.slug === "sacms-global" ||
    tenant.slug === "sacms" ||
    tenant.id === "sacms-global" ||
    tenant.name.toLowerCase() === "sacms global"
  )
}

export const GET = withAdminAuth(async (request, context, { session }) => {
    const { tenantId } = await context.params
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        databaseUrl: true,
        description: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            contentTypeAssignments: true,
            singleTypeAssignments: true,
            media: true,
          }
        }
      }
    })

    if (!tenant) return apiError("not_found", { message: "Tenant not found" })

    const reveal = request.nextUrl.searchParams.get("reveal")
    if (reveal === "databaseUrl") {
      logAudit({
        userId: session.user.id,
        action: AuditAction.SECRET_REVEALED,
        entity: "Tenant",
        entityId: tenant.id,
        data: { field: "databaseUrl", tenantName: tenant.name },
      })
      return NextResponse.json({ field: "databaseUrl", value: tenant.databaseUrl || "" })
    }

    // Masked by default — see the same comment in the list route
    // (src/app/api/admin/tenants/route.ts) for why this full connection
    // string (including its password) isn't returned as-is.
    return NextResponse.json({ tenant: { ...tenant, databaseUrl: tenant.databaseUrl ? MASK : null } })
})

export const PATCH = withAdminAuth(async (request, context, { session }) => {
    const { tenantId } = await context.params
    const existing = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!existing) return apiError("not_found", { message: "Tenant not found" })

    const result = await validateBody(request, updateTenantSchema)
    if ("error" in result) return result.error

    const data: Record<string, unknown> = { ...result.data }

    // The global/system tenant could previously be suspended or have its
    // plan/databaseUrl rewritten through this exact endpoint — only DELETE
    // had a guard. A single "Tangguhkan Workspace" click on it (no
    // confirmation dialog, unlike delete) could take core seed/global
    // content serving down platform-wide.
    if (isGlobalTenant(existing) && (data.status !== undefined || data.plan !== undefined || data.databaseUrl !== undefined)) {
      return apiError("validation", { message: "Cannot suspend, change plan, or change database connection for the global system tenant" })
    }

    if (data.databaseUrl === MASK) {
      // Unchanged — the client never has the real value to send back.
      delete data.databaseUrl
    } else if (data.databaseUrl === "") {
      data.databaseUrl = null
    } else if (typeof data.databaseUrl === "string") {
      // This value is used to open a real server-side Postgres connection
      // for this tenant on every request (see src/lib/database.ts's
      // acquireTenantClient) — an unvalidated host here is a direct SSRF
      // into the production network, same risk as the per-user "master
      // infrastructure" override closed earlier (src/app/api/auth/user/
      // infrastructure/route.ts).
      let parsed: URL
      try {
        parsed = new URL(data.databaseUrl)
      } catch {
        return apiError("validation", { message: "Invalid database URL" })
      }
      if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
        return apiError("validation", { message: "Database URL must use the postgres:// or postgresql:// scheme" })
      }
      try {
        await assertPublicHost(parsed.hostname)
      } catch (e) {
        return apiError("validation", { message: e instanceof SsrfError ? `Database URL rejected: ${e.message}` : "Invalid database URL" })
      }
    }

    const tenant = await db.tenant.update({ where: { id: tenantId }, data })

    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_UPDATED,
      entity: "Tenant",
      entityId: tenant.id,
      data: {
        name: tenant.name,
        changedFields: Object.keys(data),
        ...(data.status !== undefined ? { statusChangedFrom: existing.status, statusChangedTo: tenant.status } : {}),
        databaseUrlChanged: "databaseUrl" in data,
      },
    })

    return NextResponse.json({ tenant })
})

export const DELETE = withAdminAuth(async (request, context, { session }) => {
    const { tenantId } = await context.params

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return apiError("not_found", { message: "Tenant not found" })

    if (isGlobalTenant(tenant)) {
      return apiError("validation", { message: "Cannot delete global tenant" })
    }

    // The client-side confirmation (typing the tenant's name/slug/id) is
    // real UX friction against a mis-click, but it was never re-checked
    // here — a direct DELETE call (devtools/curl/replayed request) with a
    // valid admin session needed zero confirmation to hard-delete a
    // tenant's database, storage bucket, and every row, irreversibly.
    const body = await request.json().catch(() => ({}))
    const confirmation = String(body?.confirmation || "").trim().toLowerCase()
    const validMatch =
      confirmation.length > 0 &&
      (confirmation === tenant.name.trim().toLowerCase() ||
        confirmation === tenant.id.trim().toLowerCase() ||
        confirmation === (tenant.slug || "").trim().toLowerCase())
    if (!validMatch) {
      return apiError("validation", { message: "Confirmation text does not match the tenant's name, slug, or id" })
    }

    // 1. Delete physical assets from storage (MinIO bucket or local disk)
    if (tenant.slug) {
      await deleteTenantStorage({ id: tenant.id, slug: tenant.slug })
    }

    // 2. Drop dedicated database if exists (Hybrid Multitenancy)
    if (tenant.databaseUrl) {
      console.log(`[Admin Tenant Deletion] Dropping dedicated DB for ${tenant.slug}`)
      await dropEnterpriseDb(tenant.databaseUrl)
    }

    // 3. Clean up any related child records that lack foreign-key cascade in PostgreSQL
    const tenantSubscriptions = await db.subscription.findMany({
      where: { tenantId },
      select: { id: true }
    })
    const subIds = tenantSubscriptions.map(s => s.id)

    if (subIds.length > 0) {
      await db.paymentTransaction.deleteMany({
        where: { subscriptionId: { in: subIds } }
      }).catch(err => console.warn("Failed to clean up subscription payment transactions:", err))

      await db.invoice.deleteMany({
        where: { subscriptionId: { in: subIds } }
      }).catch(err => console.warn("Failed to clean up subscription invoices:", err))
    }

    // Clean up custom plan overrides
    await db.customPlanOverride.deleteMany({
      where: { tenantId }
    }).catch(err => console.warn("Failed to clean up custom plan overrides:", err))

    // 4. Delete tenant from master database
    await db.tenant.delete({
      where: { id: tenantId }
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_DELETED,
      entity: "Tenant",
      entityId: tenantId,
      data: { name: tenant.name, slug: tenant.slug, hadDedicatedDb: !!tenant.databaseUrl, deletedByAdmin: true },
    })

    return NextResponse.json({ success: true })
})
