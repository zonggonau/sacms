import { NextResponse } from "next/server"
import { withAdminAuth, handleRouteError } from "@/lib/api/route-helpers"
import { biznetGio, BiznetGioError } from "@/lib/biznetgio"

// GET /api/admin/biznet-gio/products/[id]/oss — list OS options for one
// Biznet Gio product (read-only, no cost).
export const GET = withAdminAuth(async (_request, context) => {
  const { id } = await context.params
  try {
    const oss = await biznetGio.listProductOs(id)
    return NextResponse.json({ oss })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/products/[id]/oss", method: "GET" })
  }
})
