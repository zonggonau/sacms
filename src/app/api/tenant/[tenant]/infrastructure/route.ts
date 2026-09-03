import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { checkServerHealth } from "@/lib/infrastructure/provisioner"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

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
        }
      : null,
    isCustomDbConfigured: !!tenant?.databaseUrl,
    isCustomStorageConfigured: !!tenant?.storageConfig,
  })
})

export const POST = withStaffAuth(
  async (_req, _context, { access }) => {
    const server = await db.infrastructureServer.findFirst({
      where: { tenantId: access.tenantId, status: "active" },
      orderBy: { createdAt: "desc" },
    })
    if (!server) {
      return apiError("not_found", { message: "No active dedicated server found for this workspace" })
    }

    return NextResponse.json(await checkServerHealth(server.id))
  },
  { minRole: "admin" },
)
