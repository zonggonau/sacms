import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

/**
 * POST /api/admin/tenants/[tenantId]/content-types/[contentTypeId]
 * Enable or disable a content type for a tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; contentTypeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId, contentTypeId } = await params
    const body = await request.json()

    // Check if assignment exists
    const existing = await db.tenantContentTypeAssignment.findUnique({
      where: {
        tenantId_contentTypeId: {
          tenantId,
          contentTypeId,
        },
      },
    })

    if (existing) {
      // Update existing assignment
      const updated = await db.tenantContentTypeAssignment.update({
        where: {
          tenantId_contentTypeId: {
            tenantId,
            contentTypeId,
          },
        },
        data: {
          enabled: body.enabled,
        },
      })
      return NextResponse.json(updated)
    } else {
      // Create new assignment
      const created = await db.tenantContentTypeAssignment.create({
        data: {
          tenantId,
          contentTypeId,
          enabled: body.enabled,
        },
      })
      return NextResponse.json(created)
    }
  } catch (error) {
    console.error("Error updating content type assignment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}