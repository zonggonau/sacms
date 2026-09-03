import { NextResponse } from "next/server"
import { calculateLiveFinancialReports } from "@/lib/billing/financial-engine"
import { withAdminAuth } from "@/lib/api/route-helpers"

/**
 * GET /api/admin/billing/reports
 * Comprehensive financial report: P&L, COGS, margins, unit economics, tenant breakdown.
 */
export const GET = withAdminAuth(
  async () => NextResponse.json(await calculateLiveFinancialReports()),
  { allowRoles: ["admin"] },
)
