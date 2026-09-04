import { db } from "@/lib/database"

export interface VpsDeployFile {
  name: string
  content: string
}

export interface VpsDeployOptions {
  files?: VpsDeployFile[]
  domain?: string
  chatId?: string | null
}

export interface VpsDeployResult {
  success: boolean
  url: string
  hostType: "vps" | "simulation"
  vpsIp?: string
  serverName?: string
  state: "READY" | "BUILDING" | "ERROR"
  error?: string
  /** true when this call did NOT actually SSH/build/start anything on the VPS
   *  — it only recorded intent in Settings. Real Contabo delivery (file
   *  transfer, build, process supervision) is not implemented yet; callers
   *  MUST surface this rather than presenting it as a live production deploy. */
  simulated?: boolean
}

/**
 * Deploy AI Website Builder output directly to the tenant's Dedicated Contabo VPS.
 * Hosts Next.js frontend alongside PostgreSQL 17 and MinIO S3 at 0 additional cost.
 *
 * NOTE: this currently only provisions a URL and records deployment metadata
 * in Settings — it does not yet SSH into the Contabo server, transfer the
 * generated files, run a build, or supervise a process. Every result is
 * flagged `simulated: true` until that real delivery path is implemented.
 */
export async function deployAiWebsiteToVps(
  tenantId: string,
  options: VpsDeployOptions = {}
): Promise<VpsDeployResult> {
  try {
    // 1. Fetch active infrastructure server for tenant
    const server = await db.infrastructureServer.findFirst({
      where: {
        tenantId,
        status: { in: ["active", "provisioning", "ready"] },
      },
      orderBy: { createdAt: "desc" }
    })

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, name: true, customDomain: true, plan: true }
    })

    const tenantSlug = tenant?.slug || tenantId
    const effectiveDomain = options.domain || tenant?.customDomain

    // If server is active on VPS
    const vpsIp = server?.serverIpv4 || "161.97.100.1"
    const serverName = server?.name || "Contabo Dedicated VPS"

    // 2. Generate live URL
    const liveUrl = effectiveDomain 
      ? `https://${effectiveDomain}` 
      : (server?.serverIpv4 ? `http://${server.serverIpv4}` : `https://web-${tenantSlug}.sacms.cloud`)

    // 3. Save VPS deployment records to tenant settings
    const now = new Date().toISOString()
    await Promise.all([
      db.setting.upsert({
        where: { key: `${tenantId}_vpsDeploymentUrl` },
        update: { value: liveUrl },
        create: { tenantId, key: `${tenantId}_vpsDeploymentUrl`, value: liveUrl }
      }),
      db.setting.upsert({
        where: { key: `${tenantId}_vpsDeployedAt` },
        update: { value: now },
        create: { tenantId, key: `${tenantId}_vpsDeployedAt`, value: now }
      }),
      db.setting.upsert({
        where: { key: `${tenantId}_v0Status` },
        update: { value: "project" },
        create: { tenantId, key: `${tenantId}_v0Status`, value: "project" }
      }),
      db.setting.upsert({
        where: { key: `${tenantId}_v0HostingProvider` },
        update: { value: "vps" },
        create: { tenantId, key: `${tenantId}_v0HostingProvider`, value: "vps" }
      }),
      effectiveDomain ? db.setting.upsert({
        where: { key: `${tenantId}_customDomain` },
        update: { value: effectiveDomain },
        create: { tenantId, key: `${tenantId}_customDomain`, value: effectiveDomain }
      }) : Promise.resolve(null)
    ])

    return {
      success: true,
      url: liveUrl,
      hostType: server ? "vps" : "simulation",
      vpsIp,
      serverName,
      state: "READY",
      // Always true today — see the NOTE above deployAiWebsiteToVps. Even when
      // a real `server` record exists, no file transfer/build/process start
      // has actually happened yet.
      simulated: true,
    }
  } catch (error: any) {
    console.error("[VPS Deployer Error]", error)
    return {
      success: false,
      url: "",
      hostType: "vps",
      state: "ERROR",
      error: error.message || "Failed to deploy website to dedicated VPS"
    }
  }
}
