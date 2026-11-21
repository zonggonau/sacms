import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { withAdminAuth } from "@/lib/api/route-helpers"

// GlobalComponent is platform catalog data (no tenantId FK — see
// prisma/schema.prisma), authored only via the platform-level
// mcp-global-schema MCP server. This admin listing shows every component
// (draft or published), same pattern as /api/admin/website-templates — a
// read + publish-toggle dashboard; creating/editing `fields` stays MCP-only.
export const GET = withAdminAuth(async () => {
  const components = await db.globalComponent.findMany({
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ components })
})
