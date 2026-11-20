import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { removeWorkspace } from "@/lib/workspace-deletion"
import { withAdminAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { assertPublicHost, SsrfError } from "@/lib/safe-url"

const MASK = "••••••••"

/**
 * The former "SaCMS Global" system tenant no longer owns any content of its
 * own — the marketing site's landing-page Single Type and its blog Posts
 * were migrated to live at `tenantId: null` directly once nothing needed a
 * tenant dashboard page to manage them through anymore (see
 * src/actions/cms-frontend.ts, src/lib/public-api.ts). This is the one-time
 * move: any row still parked under the old tenant id gets re-pointed to
 * `tenantId: null` before the tenant row itself is deleted below, so the
 * live site's content survives the cascade rather than being deleted with
 * it. A no-op for every other tenant (and a no-op here too once this has
 * already run once, since there's nothing left to move).
 */
async function migrateGlobalContentToPlatformLevel(tenantId: string) {
  const assignments = await db.tenantSingleTypeAssignment.findMany({ where: { tenantId } })
  for (const a of assignments) {
    const clash = await db.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: null, singleTypeId: a.singleTypeId, locale: a.locale },
    })
    if (clash) {
      // A tenantId:null row already covers this Single Type/locale —
      // keep that one (it's the one getLandingData() already reads) and
      // drop this now-redundant tenant-scoped copy instead of violating
      // the [tenantId, singleTypeId, locale] unique constraint.
      await db.tenantSingleTypeAssignment.delete({ where: { id: a.id } })
    } else {
      await db.tenantSingleTypeAssignment.update({ where: { id: a.id }, data: { tenantId: null } })
    }
  }

  // ContentEntry has no such unique constraint on (tenantId, ...), so a
  // straight bulk move is safe.
  await db.contentEntry.updateMany({ where: { tenantId }, data: { tenantId: null } })
}

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

    const wasGlobalTenant = isGlobalTenant(tenant)
    if (wasGlobalTenant) {
      await migrateGlobalContentToPlatformLevel(tenant.id)
    }

    await removeWorkspace(tenant, wasGlobalTenant)

    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_DELETED,
      entity: "Tenant",
      entityId: tenantId,
      data: { name: tenant.name, slug: tenant.slug, hadDedicatedDb: !!tenant.databaseUrl, deletedByAdmin: true, wasGlobalTenant },
    })

    return NextResponse.json({ success: true })
})
