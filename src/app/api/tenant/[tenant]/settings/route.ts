import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateTenantSettingsSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"
import { isEnterpriseTenant } from "@/lib/license"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

// GET /api/tenant/[tenant]/settings - Get tenant settings
export const GET = withStaffAuth(async (_request, _context, { access, session }) => {
    const tenant = await db.tenant.findUnique({
      where: { id: access.tenantId },
      include: {
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      }
    })

    if (!tenant) {
      return apiError("not_found", { message: "Tenant not found" })
    }

    // Get tenant settings from Setting model
    const settings = await db.setting.findMany({
      where: {
        OR: [
          { tenantId: tenant.id },
          { tenantId: null }, // Global defaults
        ],
      },
    })

    // Get API key
    const apiKeys = await db.apiKey.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 1
    })
    const defaultApiKey = apiKeys.length > 0 ? apiKeys[0].key : ""

    // Build settings object
    const settingsMap: Record<string, string> = {}
    settings.forEach((s) => {
      settingsMap[s.key] = s.value
      if (s.key.startsWith(`${tenant.id}_`)) {
        const rawKey = s.key.slice(`${tenant.id}_`.length)
        settingsMap[rawKey] = s.value
      }
    })

    const sub = tenant.subscriptions[0]
    let daysRemaining: number | null = null
    
    if (sub?.currentPeriodEnd) {
      const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    const { getGlobalWorkspaceId } = await import("@/lib/settings");
    const globalId = await getGlobalWorkspaceId();
    let isEnterprise = await isEnterpriseTenant(globalId, session.user.id)
    if (!isEnterprise) {
      isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
    }

    // Also consider enterprise if plan is enterprise/postgres, user is super admin, or custom DB is configured
    if (!isEnterprise) {
      const planLower = (tenant.plan || "").toLowerCase()
      if (
        planLower.includes("enterprise") ||
        planLower.includes("vps") ||
        planLower.includes("postgres") ||
        session.user.role === "super_admin" ||
        !!tenant.databaseUrl
      ) {
        isEnterprise = true
      }
    }

    return NextResponse.json({
      settings: {
        id: tenant.id,
        name: tenant.name,
        description: tenant.description,
        plan: tenant.plan,
        status: tenant.status,
        subscriptionStatus: sub?.status || null,
        daysRemaining,
        isEnterprise,
        // Custom Infrastructure
        databaseUrl: tenant.databaseUrl || "",
        storageConfig: tenant.storageConfig || null,
        // API settings with defaults
        apiKey: defaultApiKey,
        apiVersion: settingsMap.apiVersion || "v1",
        rateLimiting: settingsMap.rateLimiting !== "false",
        requestsPerMinute: parseInt(settingsMap.requestsPerMinute || "60"),
        burstLimit: parseInt(settingsMap.burstLimit || "100"),
        corsOrigins: settingsMap.corsOrigins || "",
        previewUrl: settingsMap.previewUrl || "",
        // Email settings
        smtpHost: settingsMap.smtpHost || "",
        smtpPort: settingsMap.smtpPort || "",
        smtpUser: settingsMap.smtpUser || "",
        smtpPassword: settingsMap.smtpPassword || "",
        fromEmail: settingsMap.fromEmail || "",
        fromName: settingsMap.fromName || "",
        // Security settings
        twoFactorRequired: settingsMap.twoFactorRequired === "true",
        ipWhitelist: settingsMap.ipWhitelist === "true",
        allowedIps: settingsMap.allowedIps || "",
        auditLogging: settingsMap.auditLogging !== "false",
      },
    })
})

// PUT /api/tenant/[tenant]/settings - Update tenant settings
export const PUT = withStaffAuth(
  async (request, _context, { access, session }) => {
    const tenant = await db.tenant.findUnique({ where: { id: access.tenantId } })
    if (!tenant) {
      return apiError("not_found", { message: "Tenant not found" })
    }

    const result = await validateBody(request, updateTenantSettingsSchema)
    if ("error" in result) return result.error
    const body = result.data
    const {
      name,
      description,
      apiVersion,
      rateLimiting,
      requestsPerMinute,
      burstLimit,
      corsOrigins,
      twoFactorRequired,
      ipWhitelist,
      allowedIps,
      auditLogging,
      databaseUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      fromEmail,
      fromName,
      storageConfig,
      previewUrl,
    } = body

    const normalizedNewDbUrl = (databaseUrl || "").trim()
    const normalizedOldDbUrl = (tenant.databaseUrl || "").trim()
    const isDbUrlChanging = databaseUrl !== undefined && normalizedNewDbUrl !== normalizedOldDbUrl
    
    const hasCustomStorage = storageConfig && typeof storageConfig === "object" && Boolean(storageConfig.bucket || storageConfig.endpoint)
    const oldStorageConfig = tenant.storageConfig && typeof tenant.storageConfig === "object" ? tenant.storageConfig : null
    const isStorageChanging = storageConfig !== undefined && JSON.stringify(storageConfig || null) !== JSON.stringify(oldStorageConfig)

    // Only require Enterprise license/plan if user is configuring or changing to a non-empty custom infrastructure
    if ((isDbUrlChanging && normalizedNewDbUrl !== "") || (isStorageChanging && hasCustomStorage)) {
      const { getGlobalWorkspaceId } = await import("@/lib/settings");
      const globalId = await getGlobalWorkspaceId();
      let isEnterprise = await isEnterpriseTenant(globalId, session.user.id)
      if (!isEnterprise) {
        isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
      }
      if (!isEnterprise) {
        const planLower = (tenant.plan || "").toLowerCase()
        if (
          planLower.includes("enterprise") ||
          planLower.includes("vps") ||
          planLower.includes("vds") ||
          planLower.includes("postgres") ||
          session.user.role === "super_admin"
        ) {
          isEnterprise = true
        }
      }
      if (!isEnterprise) {
        return NextResponse.json({ error: "Paket Enterprise / Lisensi Dedicated diperlukan untuk konfigurasi infrastruktur kustom" }, { status: 403 })
      }
    }

    // Update tenant basic info and custom infrastructure
    const tenantUpdateData: Record<string, any> = {}
    if (name !== undefined && name.trim() !== "") tenantUpdateData.name = name.trim()
    if (description !== undefined) tenantUpdateData.description = description || null
    if (databaseUrl !== undefined) tenantUpdateData.databaseUrl = normalizedNewDbUrl === "" ? null : normalizedNewDbUrl
    if (storageConfig !== undefined) tenantUpdateData.storageConfig = !hasCustomStorage ? Prisma.JsonNull : storageConfig

    if (Object.keys(tenantUpdateData).length > 0) {
      await db.tenant.update({
        where: { id: tenant.id },
        data: tenantUpdateData,
      })
    }

    // Update settings in Setting model
    const settingsToUpdate: Record<string, string> = {}
    
    if (apiVersion !== undefined) settingsToUpdate.apiVersion = String(apiVersion || "v1")
    if (rateLimiting !== undefined) settingsToUpdate.rateLimiting = String(rateLimiting)
    if (requestsPerMinute !== undefined) settingsToUpdate.requestsPerMinute = String(requestsPerMinute)
    if (burstLimit !== undefined) settingsToUpdate.burstLimit = String(burstLimit)
    if (corsOrigins !== undefined) settingsToUpdate.corsOrigins = String(corsOrigins || "")
    if (previewUrl !== undefined) settingsToUpdate.previewUrl = String(previewUrl || "")
    if (twoFactorRequired !== undefined) settingsToUpdate.twoFactorRequired = String(twoFactorRequired)
    if (ipWhitelist !== undefined) settingsToUpdate.ipWhitelist = String(ipWhitelist)
    if (allowedIps !== undefined) settingsToUpdate.allowedIps = String(allowedIps || "")
    if (auditLogging !== undefined) settingsToUpdate.auditLogging = String(auditLogging)
    if (smtpHost !== undefined) settingsToUpdate.smtpHost = String(smtpHost || "")
    if (smtpPort !== undefined) settingsToUpdate.smtpPort = String(smtpPort || "")
    if (smtpUser !== undefined) settingsToUpdate.smtpUser = String(smtpUser || "")
    if (smtpPassword !== undefined) settingsToUpdate.smtpPassword = String(smtpPassword || "")
    if (fromEmail !== undefined) settingsToUpdate.fromEmail = String(fromEmail || "")
    if (fromName !== undefined) settingsToUpdate.fromName = String(fromName || "")

    // Upsert each setting
    for (const [key, value] of Object.entries(settingsToUpdate)) {
      await db.setting.upsert({
        where: {
          key: `${tenant.id}_${key}`,
        },
        create: {
          key: `${tenant.id}_${key}`,
          value: String(value),
          tenantId: tenant.id,
        },
        update: {
          value: String(value),
        },
      })
    }

    return NextResponse.json({ success: true })
  },
  { minRole: "admin" },
)
