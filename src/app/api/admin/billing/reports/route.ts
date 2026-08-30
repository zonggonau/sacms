import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { calculateLiveFinancialReports, getPlansUnitEconomics } from "@/lib/billing/financial-engine"

/**
 * GET /api/admin/billing/reports
 * Comprehensive financial report: P&L, COGS, Profit Margins, Unit Economics, Tenant Breakdown
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin" && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const reports = await calculateLiveFinancialReports()

    return NextResponse.json(reports)
  } catch (error) {
    console.error("Error calculating financial reports:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
