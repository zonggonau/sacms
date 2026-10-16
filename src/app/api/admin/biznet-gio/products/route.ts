import { NextResponse } from "next/server"
import { withAdminAuth, handleRouteError } from "@/lib/api/route-helpers"
import { biznetGio, BiznetGioError } from "@/lib/biznetgio"

// GET /api/admin/biznet-gio/products — list Biznet Gio NEO Lite VM products
// (read-only, no cost). Staff-only, backs the assisted-setup VPS
// provisioning tool at /admin/enterprise/infrastructure.
export const GET = withAdminAuth(async () => {
  try {
    const products = await biznetGio.listProducts()
    return NextResponse.json({ products })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/products", method: "GET" })
  }
})
