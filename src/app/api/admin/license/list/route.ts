/**
 * GET /api/admin/license/list
 * List all enterprise licenses (admin only)
 */
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const adminRoles = ["super_admin", "admin", "employee", "karyawan"]
    if (!session?.user || !adminRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") // active | expired | revoked

    const where: any = {}
    if (status) where.status = status

    const licenses = await db.enterpriseLicense.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })

    const now = new Date()
    const enriched = licenses.map((l) => ({
      id: l.id,
      licenseKey: l.licenseKey,
      displayKey: `${l.licenseKey.slice(0, 10)}...${l.licenseKey.slice(-6)}`,
      customerName: l.customerName,
      customerEmail: l.customerEmail,
      organization: l.organization,
      type: l.type,
      expiresAt: l.expiresAt,
      isExpired: l.expiresAt < now,
      daysRemaining: Math.max(0, Math.floor((l.expiresAt.getTime() - now.getTime()) / 86400000)),
      status: l.status,
      lastValidatedAt: l.lastValidatedAt,
      validatedCount: l.validatedCount,
      createdAt: l.createdAt,
    }))

    return NextResponse.json({ licenses: enriched, total: enriched.length })
  } catch (err) {
    console.error("Error listing licenses:", err)
    return NextResponse.json({ error: "Failed to list licenses" }, { status: 500 })
  }
}
