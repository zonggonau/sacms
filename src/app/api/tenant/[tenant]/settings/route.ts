import { NextResponse } from "next/server"
import { db, PrismaClient } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { updateTenantSettingsSchema } from "@/lib/validations"
import { Prisma } from "@prisma/client"
import { isEnterpriseTenant } from "@/lib/license"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

// GET /api/tenant/[tenant]/settings - Get tenant settings
export const GET = withStaffAuth(async (_request, _context, { access, session }) => {
    // Secrets (DB DSN, storage keys, SMTP password, API key) are only handed
    // to the workspace owner; a plain admin sees them masked.
    const canSeeSecrets = access.role === "owner" || session.user.role === "super_admin"
    const mask = (v: string) => (v ? "••••••••" : "")

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
    // Precise license check — exactly what the PUT handler below gates
    // databaseUrl/storageConfig writes on (super_admin OR an active
    // Enterprise License, nothing looser). Kept separate from the broader
    // `isEnterprise` flag below, which also lights up for an "enterprise"
    // plan slug or an already-configured databaseUrl — neither of those
    // implies an actual license, so they'd wrongly show the self-service
    // BYODB/BYOS card to an account that would then get a 403 trying to save.
    const hasEnterpriseLicense = await isEnterpriseTenant(globalId, session.user.id)

    let isEnterprise = hasEnterpriseLicense
    if (!isEnterprise) {
      isEnterprise = await isEnterpriseTenant(tenant.id, session.user.id)
    }

    // Also consider enterprise if plan is enterprise/postgres, user is super admin, or custom DB is configured
    if (!isEnterprise) {
      const planLower = (tenant.plan || "").toLowerCase()
      if (
        planLower.includes("enterprise") ||
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
        hasEnterpriseLicense,
        // Custom Infrastructure (owner-only)
        databaseUrl: canSeeSecrets ? tenant.databaseUrl || "" : mask(tenant.databaseUrl || ""),
        storageConfig: canSeeSecrets ? tenant.storageConfig || null : (tenant.storageConfig ? { configured: true } : null),
        // API settings with defaults
        apiKey: canSeeSecrets ? defaultApiKey : mask(defaultApiKey),
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
        smtpPassword: canSeeSecrets ? settingsMap.smtpPassword || "" : mask(settingsMap.smtpPassword || ""),
        fromEmail: settingsMap.fromEmail || "",
        fromName: settingsMap.fromName || "",
        // Security settings
        twoFactorRequired: settingsMap.twoFactorRequired === "true",
        ipWhitelist: settingsMap.ipWhitelist === "true",
        allowedIps: settingsMap.allowedIps || "",
        auditLogging: settingsMap.auditLogging !== "false",
      },
    })
}, { minRole: "admin" })

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

    // The workspace's own database/storage is a managed service: the SaCMS IT team connects and
    // disconnects it (lib/billing/managed-infra.ts). Only a self-hosted instance with an enterprise
    // license lets its own admins change it.
    if (isDbUrlChanging || isStorageChanging) {
      let allowed = session.user.role === "super_admin"
      if (!allowed) {
        const { getGlobalWorkspaceId } = await import("@/lib/settings")
        allowed = await isEnterpriseTenant(await getGlobalWorkspaceId(), session.user.id)
      }
      if (!allowed) {
        return NextResponse.json(
          { error: "Database & storage sendiri disambungkan oleh tim IT SaCMS. Pesan layanannya di menu Langganan → Add-on." },
          { status: 403 },
        )
      }
    }

    // Prove the new connection actually works BEFORE persisting anything —
    // this is now self-service for the tenant owner (not just SaCMS IT
    // staff via the manual console), so a typo here would otherwise
    // silently break this tenant's own CMS the moment it's saved. Clearing
    // a value back to empty (disconnecting) never needs this — only
    // connecting to a new, non-empty value does.
    if (isDbUrlChanging && normalizedNewDbUrl !== "") {
      const testClient = new PrismaClient({ datasources: { db: { url: normalizedNewDbUrl } } })
      try {
        await testClient.$queryRaw`SELECT 1`
      } catch {
        return apiError("validation", {
          message: "Gagal terhubung ke database yang Anda masukkan. Periksa kembali connection string (host, port, username, password, nama database).",
        })
      } finally {
        await testClient.$disconnect().catch(() => {})
      }
    }

    if (isStorageChanging && hasCustomStorage) {
      const { endpoint, accessKey, secretKey, bucket } = storageConfig as Record<string, string>
      if (!endpoint || !accessKey || !secretKey || !bucket) {
        return apiError("validation", {
          message: "Lengkapi semua field storage (endpoint, access key, secret key, bucket) sebelum menyimpan.",
        })
      }
      try {
        const { createS3Client } = await import("@/lib/s3-client")
        const { HeadBucketCommand } = await import("@aws-sdk/client-s3")
        const s3 = createS3Client(endpoint, accessKey, secretKey)
        await s3.send(new HeadBucketCommand({ Bucket: bucket }))
      } catch {
        return apiError("validation", {
          message: "Gagal terhubung ke storage (MinIO/S3) yang Anda masukkan. Periksa kembali endpoint, access key, secret key, dan nama bucket.",
        })
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

    if (isDbUrlChanging || isStorageChanging) {
      const { activateManagedInfraIfConnected } = await import("@/lib/billing/managed-infra")
      await activateManagedInfraIfConnected(tenant.id, Boolean(normalizedNewDbUrl || hasCustomStorage))
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
