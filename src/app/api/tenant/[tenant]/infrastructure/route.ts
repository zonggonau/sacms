import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { checkServerHealth } from "@/lib/infrastructure/provisioner"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true, slug: true, name: true, plan: true, databaseUrl: true, storageConfig: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Check membership
    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id }
    })
    const isSuperAdmin = session.user.role === "super_admin"

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Find active or recent infrastructure server
    const server = await db.infrastructureServer.findFirst({
      where: {
        tenantId: tenant.id,
        status: { in: ["active", "provisioning", "configuring", "suspended", "error"] }
      },
      orderBy: { createdAt: "desc" }
    })

    return NextResponse.json({
      server: server ? {
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
      } : null,
      isCustomDbConfigured: !!tenant.databaseUrl,
      isCustomStorageConfigured: !!tenant.storageConfig,
    })
  } catch (error: any) {
    console.error("[API Tenant Infrastructure GET Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tenant: tenantSlug } = await params
    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
      select: { id: true }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    const server = await db.infrastructureServer.findFirst({
      where: { tenantId: tenant.id, status: "active" },
      orderBy: { createdAt: "desc" }
    })

    if (!server) {
      return NextResponse.json({ error: "No active dedicated server found for this tenant" }, { status: 404 })
    }

    const result = await checkServerHealth(server.id)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error("[API Tenant Infrastructure POST Error]:", error)
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 })
  }
}
