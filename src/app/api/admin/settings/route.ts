import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { getPlatformSettings, syncPlatformSettingsCache, type PlatformSettings } from "@/lib/settings"
import { maskSecretSettings, isSecretSettingKey, isUnchangedSecretValue } from "@/lib/settings-secrets"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, readJson, apiError } from "@/lib/api/route-helpers"

// Fields stored as the literal strings "true"/"false" — anything else would
// silently break a consumer that only ever checks `=== "true"`.
const BOOLEAN_SETTINGS = new Set<keyof PlatformSettings>([
  "autoProvisionSeedData", "maintenanceMode", "autoWebpConvert", "autoGenerateThumbnails", "smtpSecure",
])
// Fields consumers parse with Number()/parseInt() — a non-numeric value
// doesn't error there, it just silently resolves to NaN/0 downstream.
const NUMERIC_SETTINGS = new Set<keyof PlatformSettings>([
  "maxWorkspacesPerUser", "defaultStorageLimitMb", "apiRateLimitPerMinute", "webhookMaxRetries",
  "maxUploadFileSizeMb", "freePlanAiMonthlyWords", "smtpPort", "auditLogRetentionDays", "apiLogRetentionDays",
])
const ENUM_SETTINGS: Partial<Record<keyof PlatformSettings, readonly string[]>> = {
  registrationMode: ["open", "invite_only", "closed"],
  customDomainPolicy: ["paid_only", "all_plans", "disabled"],
  midtransMode: ["sandbox", "production"],
}

// GET /api/admin/settings - all global settings. Secret fields (API keys,
// SMTP/DB passwords, etc.) are masked — the real values never leave the
// server here. Use GET /api/admin/settings/reveal to fetch one real value
// on demand (audited), for the UI's "show" toggle.
export const GET = withAdminAuth(async () => {
  const settings = await getPlatformSettings()
  const envStatus = {
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    directUrlConfigured: Boolean(process.env.DIRECT_URL),
    nextAuthSecretConfigured: Boolean(process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET !== "generate-a-random-secret-here"),
    nextAuthUrl: process.env.NEXTAUTH_URL || "",
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL || "",
    redisConfigured: Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL),
    cronSecretConfigured: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET !== "generate-a-cron-secret"),
    gatewayIp: process.env.PUBLIC_GATEWAY_IP || "164.68.116.79",
    cnameTarget: process.env.PUBLIC_CNAME_TARGET || "cname.sacms.cloud",
    selfHostMode: process.env.SELFHOST_MODE === "true",
    nodeEnv: process.env.NODE_ENV || "development",
    hasMinioEndpoint: Boolean(process.env.S3_ENDPOINT),
  }
  return NextResponse.json({ 
    settings: maskSecretSettings(settings),
    envStatus,
  })
})

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()),
})

// PUT /api/admin/settings - update global settings
export const PUT = withAdminAuth(async (request, _context, { session }) => {
  const body = await readJson(request, updateSettingsSchema)
  if (!body.ok) return body.response
  const { settings } = body.data

  // A secret field whose value is still the mask placeholder means the
  // admin never touched it in this session — skip it so we don't clobber
  // the real stored secret with the placeholder string.
  const entries = Object.entries(settings).filter(
    ([key, value]) => !(isSecretSettingKey(key) && isUnchangedSecretValue(value)),
  )

  const invalidKeys = entries
    .filter(([key, value]) => {
      const str = String(value ?? "")
      const k = key as keyof PlatformSettings
      if (BOOLEAN_SETTINGS.has(k)) return str !== "true" && str !== "false"
      if (NUMERIC_SETTINGS.has(k)) return !/^\d+$/.test(str)
      if (ENUM_SETTINGS[k]) return !ENUM_SETTINGS[k]!.includes(str)
      return false
    })
    .map(([key]) => key)

  if (invalidKeys.length > 0) {
    return apiError("validation", { message: `Nilai tidak valid untuk: ${invalidKeys.join(", ")}` })
  }

  // Fetched before the write so the audit entry below can record what each
  // non-secret value actually changed from, not just which keys were touched.
  const previousSettings = await getPlatformSettings()

  await Promise.all(
    entries.map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? ""), tenantId: null },
      }),
    ),
  )

  const persistedSettings = Object.fromEntries(entries)
  await syncPlatformSettingsCache(persistedSettings)

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "PlatformSettings",
    data: {
      // Never log secret values — only which keys changed, and never a
      // secret key's value even if it changed (name only). Non-secret keys
      // (maintenanceMode, registrationMode, etc.) get a real before/after
      // pair so the trail is actually useful for forensic review.
      updatedKeys: entries.map(([key]) => key),
      changes: entries
        .filter(([key]) => !isSecretSettingKey(key))
        .map(([key, value]) => ({
          key,
          from: (previousSettings as unknown as Record<string, unknown>)[key] ?? null,
          to: value,
        })),
    },
  })

  return NextResponse.json({ success: true, message: "Pengaturan platform berhasil disimpan." })
})
