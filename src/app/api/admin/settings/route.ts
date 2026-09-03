import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { z } from "zod"
import { getPlatformSettings, syncPlatformSettingsCache } from "@/lib/settings"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { withAdminAuth, readJson } from "@/lib/api/route-helpers"

// GET /api/admin/settings - all global settings
export const GET = withAdminAuth(async () => {
  return NextResponse.json({ settings: await getPlatformSettings() })
})

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()),
})

// PUT /api/admin/settings - update global settings
export const PUT = withAdminAuth(async (request, _context, { session }) => {
  const body = await readJson(request, updateSettingsSchema)
  if (!body.ok) return body.response
  const { settings } = body.data

  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? ""), tenantId: null },
      }),
    ),
  )

  await syncPlatformSettingsCache(settings)

  logAudit({
    userId: session.user.id,
    action: AuditAction.SETTINGS_UPDATED,
    entity: "PlatformSettings",
    data: { updatedKeys: Object.keys(settings) },
  })

  return NextResponse.json({ success: true, message: "Pengaturan platform berhasil disimpan." })
})
