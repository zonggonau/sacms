import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getV0Preview } from "@/lib/v0-client"
import { withStaffAuth } from "@/lib/api/route-helpers"

/**
 * The v0 account is shared across every tenant, so `v0.chats.list()` would leak
 * other tenants' generated sites. Return only this tenant's own chat id +
 * preview.
 */
export const GET = withStaffAuth(
  async (_request, _context, { access }) => {
    const setting = await db.setting.findUnique({
      where: { key: `${access.tenantId}_v0ChatId` },
      select: { value: true, updatedAt: true },
    })
    if (!setting?.value) return NextResponse.json({ chats: [] })

    let previewUrl: string | null = null
    try {
      previewUrl = await getV0Preview(setting.value)
    } catch {
      previewUrl = null
    }

    return NextResponse.json({
      chats: [{ id: setting.value, previewUrl, updatedAt: setting.updatedAt }],
    })
  },
  { minRole: "admin" },
)
