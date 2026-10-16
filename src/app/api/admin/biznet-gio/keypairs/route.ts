import { NextResponse } from "next/server"
import { withAdminAuth, handleRouteError } from "@/lib/api/route-helpers"
import { biznetGio, BiznetGioError } from "@/lib/biznetgio"

// GET /api/admin/biznet-gio/keypairs — list SSH keypairs already registered
// on SaCMS's Biznet Gio account (read-only, no cost). A keypair must exist
// before a VM can be created — add one from the Biznet Gio portal directly
// if the list is empty.
export const GET = withAdminAuth(async () => {
  try {
    const keypairs = await biznetGio.listKeypairs()
    return NextResponse.json({ keypairs })
  } catch (error) {
    if (error instanceof BiznetGioError) {
      return NextResponse.json({ error: error.message, details: error.body }, { status: error.status ?? 502 })
    }
    return handleRouteError(error, { route: "/api/admin/biznet-gio/keypairs", method: "GET" })
  }
})
