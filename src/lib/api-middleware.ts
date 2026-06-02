import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { enforcePlanLimit, WorkspaceResource } from "@/lib/plan-enforcement"

/**
 * Higher-order function to wrap API handlers with plan limit enforcement.
 * 
 * Usage:
 * export const POST = withPlanLimit(async (req, { params }, access) => { ... }, "content_entries")
 */
export function withPlanLimit(
  handler: (
    request: NextRequest,
    context: any,
    access: { tenantId: string; role: string }
  ) => Promise<NextResponse>,
  resource: WorkspaceResource
) {
  return async (request: NextRequest, context: any) => {
    try {
      const session = await getServerSession(authOptions)
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

      const { tenant: tenantSlug } = await context.params
      const access = await getTenantAccess(session, tenantSlug)
      if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

      // Only check limits for mutation methods
      if (["POST", "PUT", "PATCH"].includes(request.method)) {
        const enforcement = await enforcePlanLimit(access.tenantId, resource)
        if (!enforcement.allowed) {
          return NextResponse.json({ 
            error: enforcement.message,
            current: enforcement.current,
            max: enforcement.max,
            plan: enforcement.planSlug,
          }, { status: 403 })
        }
      }

      return await handler(request, context, access)
    } catch (error) {
      console.error(`[Plan Limit Middleware Error]`, error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
  }
}
