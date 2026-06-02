import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"
import { assignReviewers, getReviewAssignments } from "@/lib/content-workflow"

/**
 * GET /api/tenant/[tenant]/workflow/reviewers?entryId=...
 * Get assigned reviewers for an entry
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const { searchParams } = new URL(request.url)
    const entryId = searchParams.get("entryId")

    if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 })

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_READ)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Use getReviewAssignments which uses Master DB for assignments (multi-tenant shared table)
    const reviewers = await getReviewAssignments(entryId)

    return NextResponse.json({ reviewers })
  } catch (error) {
    console.error("Error fetching reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/tenant/[tenant]/workflow/reviewers
 * Assign reviewers to an entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const body = await request.json()
    const { entryId, reviewers } = body // reviewers: Array<{ userId, name }>

    if (!entryId || !reviewers || !Array.isArray(reviewers)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Require CONTENT_UPDATE permission to assign reviewers
    const rbac = await checkPermission(tenantSlug, PERMISSIONS.CONTENT_UPDATE)
    if (!rbac.allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    await assignReviewers(entryId, reviewers, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error assigning reviewers:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
