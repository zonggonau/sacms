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
  platformAiProvider: "openai" | "gemini" | "anthropic"
  platformAiApiKey: string
  defaultAiModel: string
  freePlanAiMonthlyWords: string
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
  platformAiProvider: "openai",
  platformAiApiKey: "",
  defaultAiModel: "gpt-4o-mini",
  freePlanAiMonthlyWords: "10000",
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
      const full = { ...DEFAULT_PLATFORM_SETTINGS, ...newSettings }
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

