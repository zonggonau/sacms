import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { checkServerHealth, startServer, stopServer, restartServer } from "@/lib/infrastructure/provisioner"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { logAudit } from "@/lib/audit-log"

export const GET = withStaffAuth(async (_req, _context, { access }) => {
  const tenant = await db.tenant.findUnique({
    where: { id: access.tenantId },
    select: { databaseUrl: true, storageConfig: true },
  })

  const server = await db.infrastructureServer.findFirst({
    where: {
      tenantId: access.tenantId,
      status: { in: ["active", "provisioning", "configuring", "suspended", "error"] },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    server: server
      ? {
          id: server.id,
          name: server.name,
          hostname: server.hostname,
          region: server.region,
          plan: server.plan,
          cpuCount: server.cpuCount,
          ramMb: server.ramMb,
          diskGb: server.diskGb,
          status: server.status,
          healthStatus: server.healthStatus,
          dbHost: server.dbHost,
          dbPort: server.dbPort,
          mediaHost: server.mediaHost,
          mediaPort: server.mediaPort,
          lastHealthCheckAt: server.lastHealthCheckAt,
          errorMessage: server.errorMessage,
          createdAt: server.createdAt,
          // Presence (not the raw value) tells the client whether this row
          // is backed by a real Contabo instance vs a BYODB-only row — used
          // to decide whether to show VPS power controls at all.
          providerServerId: server.providerServerId ? true : null,
        }
      : null,
    isCustomDbConfigured: !!tenant?.databaseUrl,
    isCustomStorageConfigured: !!tenant?.storageConfig,
  })
})

/**
 * POST /api/tenant/[tenant]/infrastructure
 * Tenant-scoped VPS lifecycle actions — the tenant-facing counterpart to the
 * super-admin-only /api/admin/infrastructure/[id] route. Every action here
 * is resolved against `access.tenantId`, so a tenant can only ever act on
 * their OWN server (no server id is ever accepted from the client).
 *
 * Body: `{ action?: "health-check" | "start" | "stop" | "restart" }`.
 * Omitting `action` keeps the original health-check-only behavior.
 */
export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const body = await req.json().catch(() => ({}))
    const action = typeof body.action === "string" ? body.action : "health-check"

    const server = await db.infrastructureServer.findFirst({
      where: { tenantId: access.tenantId, status: "active" },
      orderBy: { createdAt: "desc" },
    })
    if (!server) {
      return apiError("not_found", { message: "No active dedicated server found for this workspace" })
    }
    if (!server.providerServerId) {
      return apiError("validation", { message: "This server has no provider instance to control (BYODB or not yet provisioned)" })
    }

    switch (action) {
      case "health-check":
        return NextResponse.json(await checkServerHealth(server.id))

      case "start": {
        const ok = await startServer(server.id)
        if (ok) {
          logAudit({
            tenantId: access.tenantId,
            userId: session.user.id,
            action: "infrastructure.started",
            entity: "InfrastructureServer",
            entityId: server.id,
          })
        }
        return NextResponse.json({ success: ok, message: ok ? "Start signal sent to VPS" : "Start failed" })
      }

      case "stop": {
        const ok = await stopServer(server.id)
        if (ok) {
          logAudit({
            tenantId: access.tenantId,
            userId: session.user.id,
            action: "infrastructure.stopped",
            entity: "InfrastructureServer",
            entityId: server.id,
          })
        }
        return NextResponse.json({ success: ok, message: ok ? "Stop signal sent to VPS" : "Stop failed" })
      }

      case "restart": {
        const ok = await restartServer(server.id)
        if (ok) {
          logAudit({
            tenantId: access.tenantId,
            userId: session.user.id,
            action: "infrastructure.restarted",
            entity: "InfrastructureServer",
            entityId: server.id,
          })
        }
        return NextResponse.json({ success: ok, message: ok ? "Restart signal sent to VPS" : "Restart failed" })
      }

      default:
        return apiError("validation", { message: "Invalid action" })
    }
  },
  { minRole: "admin" },
)
