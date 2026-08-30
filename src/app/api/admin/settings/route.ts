import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { z } from "zod"
import { getPlatformSettings, syncPlatformSettingsCache } from "@/lib/settings"
import { logAudit, AuditAction } from "@/lib/audit-log"

// GET /api/admin/settings - Get all global settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await getPlatformSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any())
})

// PUT /api/admin/settings - Update global settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Format request tidak valid", details: parsed.error.format() }, { status: 400 })
    }

    const { settings } = parsed.data

    // Upsert each setting in Prisma DB
    const updates = Object.entries(settings).map(([key, value]) =>
      db.setting.upsert({
        where: { key },
        update: { value: String(value ?? "") },
        create: { key, value: String(value ?? ""), tenantId: null },
      })
    )

    await Promise.all(updates)

    // Sync to Redis cache
    await syncPlatformSettingsCache(settings)

    // Write audit log
    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "PlatformSettings",
      data: { updatedKeys: Object.keys(settings) }
    })

    return NextResponse.json({ success: true, message: "Pengaturan platform berhasil disimpan." })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

