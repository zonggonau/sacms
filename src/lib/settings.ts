import { db } from "@/lib/database"
import { getRedis } from "@/lib/redis"

export interface PlatformSettings {
  siteName: string
  siteDetail: string
  siteTagline: string
  globalTenantId: string
  registrationMode: "open" | "invite_only" | "closed"
  defaultUserPlan: string
  maxWorkspacesPerUser: string
  autoProvisionSeedData: string
  customDomainPolicy: "paid_only" | "all_plans" | "disabled"
  defaultStorageLimitMb: string
  maintenanceMode: string
  maintenanceMessage: string
  maintenanceIpWhitelist: string
  apiRateLimitPerMinute: string
  globalCorsPolicy: "wildcard" | "strict_tenant"
  ipBlacklist: string
  webhookMaxRetries: string
  maxUploadFileSizeMb: string
  allowedFileExtensions: string
  autoWebpConvert: string
  autoGenerateThumbnails: string

  // Dynamic AI Engine & Providers
  platformAiProvider: "deepseek" | "openai" | "gemini" | "anthropic"
  platformAiApiKey: string
  deepseekApiKey: string
  openaiApiKey: string
  geminiApiKey: string
  anthropicApiKey: string
  v0ApiKey: string
  vercelAccessToken: string
  defaultAiModel: string
  freePlanAiMonthlyWords: string

  // Dynamic Email / SMTP
  resendApiKey: string
  resendFrom: string
  smtpHost: string
  smtpPort: string
  smtpSecure: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string

  // Dynamic Midtrans Payment
  midtransMode: "sandbox" | "production"
  midtransServerKey: string
  midtransClientKey: string

  // Dynamic R2 / S3 Storage
  r2AccountId: string
  r2AccessKeyId: string
  r2SecretAccessKey: string
  r2BucketName: string
  r2PublicUrl: string

  // Dynamic Dedicated Infrastructure (Contabo)
  contaboClientId: string
  contaboClientSecret: string
  contaboApiUser: string
  contaboApiPassword: string

  // System Retention
  auditLogRetentionDays: string
  apiLogRetentionDays: string
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  siteName: "SaCMS",
  siteDetail: "Smart Content Management System",
  siteTagline: "Build smarter. Manage easier. Scale faster.",
  globalTenantId: "sacms-global",
  registrationMode: "open",
  defaultUserPlan: "free",
  maxWorkspacesPerUser: "1",
  autoProvisionSeedData: "true",
  customDomainPolicy: "paid_only",
  defaultStorageLimitMb: "500",
  maintenanceMode: "false",
  maintenanceMessage: "Platform SaCMS sedang dalam pemeliharaan terjadwal. Silakan coba kembali beberapa saat lagi.",
  maintenanceIpWhitelist: "127.0.0.1",
  apiRateLimitPerMinute: "120",
  globalCorsPolicy: "wildcard",
  ipBlacklist: "",
  webhookMaxRetries: "3",
  maxUploadFileSizeMb: "25",
  allowedFileExtensions: ".jpg, .jpeg, .png, .webp, .svg, .pdf, .mp4",
  autoWebpConvert: "true",
  autoGenerateThumbnails: "true",

  // AI Defaults
  platformAiProvider: "deepseek",
  platformAiApiKey: "",
  deepseekApiKey: "",
  openaiApiKey: "",
  geminiApiKey: "",
  anthropicApiKey: "",
  v0ApiKey: "",
  vercelAccessToken: "",
  defaultAiModel: "deepseek-chat",
  freePlanAiMonthlyWords: "10000",

  // Email Defaults
  resendApiKey: "",
  resendFrom: "SaCMS <noreply@mail.sacms.cloud>",
  smtpHost: "",
  smtpPort: "587",
  smtpSecure: "false",
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "SaCMS <noreply@mail.sacms.cloud>",

  // Midtrans Defaults
  midtransMode: "sandbox",
  midtransServerKey: "",
  midtransClientKey: "",

  // Storage Defaults
  r2AccountId: "",
  r2AccessKeyId: "",
  r2SecretAccessKey: "",
  r2BucketName: "",
  r2PublicUrl: "",

  // Contabo Defaults
  contaboClientId: "",
  contaboClientSecret: "",
  contaboApiUser: "",
  contaboApiPassword: "",

  // Retention
  auditLogRetentionDays: "90",
  apiLogRetentionDays: "14",
}

const CACHE_KEY = "system:platform-settings"

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<PlatformSettings>(CACHE_KEY)
      if (cached && typeof cached === "object") {
        return { ...DEFAULT_PLATFORM_SETTINGS, ...cached }
      }
    } catch {
      // fallback to DB
    }
  }

  try {
    if (!db?.setting?.findMany) {
      return DEFAULT_PLATFORM_SETTINGS
    }
    const settingsList = await db.setting.findMany({
      where: { tenantId: null }
    })
    const map: Record<string, string> = {}
    for (const s of settingsList) {
      map[s.key] = s.value
    }
    const combined = { ...DEFAULT_PLATFORM_SETTINGS, ...map } as PlatformSettings

    if (redis) {
      redis.set(CACHE_KEY, combined, { ex: 300 }).catch(() => {})
    }
    return combined
  } catch (error) {
    console.error("[Settings] Failed to fetch settings from DB:", error)
    return DEFAULT_PLATFORM_SETTINGS
  }
}

export async function syncPlatformSettingsCache(newSettings: Partial<PlatformSettings>): Promise<void> {
  const redis = getRedis()
  if (redis) {
    try {
      const current = await getPlatformSettings()
      const full = { ...current, ...newSettings }
      await redis.set(CACHE_KEY, full, { ex: 300 })
    } catch (e) {
      console.warn("[Settings] Failed to update Redis cache:", e)
    }
  }
}

export async function getGlobalWorkspaceId(): Promise<string> {
  try {
    const settings = await getPlatformSettings()
    return settings.globalTenantId || "sacms-global"
  } catch (error) {
    console.error("Error fetching globalTenantId from settings:", error)
    return "sacms-global"
  }
}

// ─── Dynamic Resolvers (Database First with .env Fallback) ───

export async function getResolvedAiConfig() {
  const settings = await getPlatformSettings()
  return {
    provider: settings.platformAiProvider || "deepseek",
    deepseekApiKey: settings.deepseekApiKey || settings.platformAiApiKey || process.env.DEEPSEEK_API_KEY || "",
    openaiApiKey: settings.openaiApiKey || (settings.platformAiProvider === "openai" ? settings.platformAiApiKey : "") || process.env.OPENAI_API_KEY || "",
    geminiApiKey: settings.geminiApiKey || (settings.platformAiProvider === "gemini" ? settings.platformAiApiKey : "") || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "",
    anthropicApiKey: settings.anthropicApiKey || (settings.platformAiProvider === "anthropic" ? settings.platformAiApiKey : "") || process.env.ANTHROPIC_API_KEY || "",
    v0ApiKey: settings.v0ApiKey || process.env.V0_API_KEY || "",
    vercelAccessToken: settings.vercelAccessToken || process.env.VERCEL_ACCESS_TOKEN || "",
    defaultModel: settings.defaultAiModel || "deepseek-chat",
  }
}

export async function getResolvedMailConfig() {
  const settings = await getPlatformSettings()
  const resendApiKey = (settings.resendApiKey || process.env.RESEND_API_KEY || "").trim()
  const resendFrom = (settings.resendFrom || process.env.RESEND_FROM || "SaCMS <noreply@mail.sacms.cloud>").trim()
  const smtpHost = (settings.smtpHost || process.env.SMTP_HOST || "").trim()
  const rawPort = (settings.smtpPort || process.env.SMTP_PORT || "587").toString().trim()
  const smtpPort = parseInt(rawPort, 10) || 587
  const smtpSecure = (settings.smtpSecure === "true" || process.env.SMTP_SECURE === "true" || smtpPort === 465)
  const smtpUser = (settings.smtpUser || process.env.SMTP_USER || "").trim()
  const smtpPass = (settings.smtpPass || process.env.SMTP_PASS || "").trim()
  const smtpFrom = (settings.smtpFrom || process.env.SMTP_FROM || resendFrom || "SaCMS <noreply@mail.sacms.cloud>").trim()

  return {
    resendApiKey,
    resendFrom,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
  }
}

export async function isMailConfigured(): Promise<boolean> {
  const mail = await getResolvedMailConfig()
  return !!(mail.resendApiKey || (mail.smtpHost && mail.smtpPort))
}

export async function getResolvedMidtransConfig() {
  const settings = await getPlatformSettings()
  const mode = settings.midtransMode || process.env.MIDTRANS_MODE || "sandbox"
  const isProduction = mode === "production"
  return {
    isProduction,
    serverKey: settings.midtransServerKey || process.env.MIDTRANS_SERVER_KEY || "",
    clientKey: settings.midtransClientKey || process.env.MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "",
    snapUrl: isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js",
  }
}

export async function getResolvedStorageConfig() {
  const settings = await getPlatformSettings()
  return {
    accountId: settings.r2AccountId || process.env.R2_ACCOUNT_ID || "",
    accessKeyId: settings.r2AccessKeyId || process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: settings.r2SecretAccessKey || process.env.R2_SECRET_ACCESS_KEY || "",
    bucketName: settings.r2BucketName || process.env.R2_BUCKET_NAME || "",
    publicUrl: settings.r2PublicUrl || process.env.R2_PUBLIC_URL || "",
  }
}

export async function getResolvedContaboConfig() {
  const settings = await getPlatformSettings()
  return {
    clientId: settings.contaboClientId || process.env.CONTABO_CLIENT_ID || "",
    clientSecret: settings.contaboClientSecret || process.env.CONTABO_CLIENT_SECRET || "",
    apiUser: settings.contaboApiUser || process.env.CONTABO_API_USER || "",
    apiPassword: settings.contaboApiPassword || process.env.CONTABO_API_PASSWORD || "",
    authUrl: process.env.CONTABO_AUTH_URL || "https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token",
    apiUrl: process.env.CONTABO_API_URL || "https://api.contabo.com/v1/compute/instances",
  }
}


