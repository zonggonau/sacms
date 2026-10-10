import { NextResponse } from "next/server"
import { withStaffAuth } from "@/lib/api/route-helpers"
import { getVpsCatalogPlans } from "@/lib/vps-catalog"

/**
 * GET /api/tenant/[tenant]/vps-catalog
 *
 * VPS/VDS plan catalog for the "subscribe this workspace to its own VPS"
 * flow inside Infrastructure > Database & Storage — a client component,
 * so it can't query the catalog server-side like the global services page
 * does. Same source (src/lib/vps-catalog.ts) as that page, so pricing
 * never drifts between the two.
 */
export const GET = withStaffAuth(async (_req, _context, _ctx) => {
  const plans = await getVpsCatalogPlans()
  return NextResponse.json({ plans })
})
