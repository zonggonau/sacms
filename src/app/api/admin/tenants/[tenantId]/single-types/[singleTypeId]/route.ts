import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

/**
 * POST /api/admin/tenants/[tenantId]/single-types/[singleTypeId]
 * Enable or disable a single type for a tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; singleTypeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId, singleTypeId } = await params
    const body = await request.json()

    // Check if assignment exists
    const existing = await db.tenantSingleTypeAssignment.findUnique({
      where: {
        tenantId_singleTypeId: {
          tenantId,
          singleTypeId,
        },
      },
    })

    if (existing) {
      // Update existing assignment
      const updated = await db.tenantSingleTypeAssignment.update({
        where: {
          tenantId_singleTypeId: {
            tenantId,
            singleTypeId,
          },
        },
        data: {
          enabled: body.enabled,
        },
      })
      return NextResponse.json(updated)
    } else {
      // Create new assignment
      const created = await db.tenantSingleTypeAssignment.create({
        data: {
          tenantId,
          singleTypeId,
          enabled: body.enabled,
        },
      })
      return NextResponse.json(created)
    }
  } catch (error) {
    console.error("Error updating single type assignment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}