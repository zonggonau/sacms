import { NextResponse } from "next/server"
import { withAdminAuth } from "@/lib/api/route-helpers"
import { fetchNocodeSummary } from "@/lib/nocode-summary"

/**
 * GET /api/admin/nocode/summary
 * Read-only SaCMS nocode summary for the admin portal (nocode ADR-016).
 * Same audience as /api/admin/billing/reports: super_admin and admin.
 *
 * Always 200 with an `ok` flag, so the page can explain a missing key or an
 * unreachable nocode app instead of showing a blank error.
 */
export const dynamic = "force-dynamic"

export const GET = withAdminAuth(
  async () =>
    NextResponse.json(await fetchNocodeSummary(), {
      headers: { "Cache-Control": "no-store" },
    }),
  { allowRoles: ["admin"] },
)
