import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit, WorkspaceResource } from "@/lib/plan-enforcement"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const searchParams = request.nextUrl.searchParams
    const feature = (searchParams.get("feature") || "content_entries") as WorkspaceResource

    const result = await enforcePlanLimit(access.tenantId, feature, session.user.id)

    return NextResponse.json({
      allowed: result.allowed,
      current: result.current,
      max: result.max,
      message: result.message,
      planSlug: result.planSlug,
    })
  } catch (error: any) {
    console.error("[LIMIT_CHECK_ERROR]:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
