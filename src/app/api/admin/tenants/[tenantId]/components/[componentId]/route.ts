import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"

/**
 * POST /api/admin/tenants/[tenantId]/components/[componentId]
 * Enable or disable a component for a tenant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string; componentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId, componentId } = await params
    const body = await request.json()

    // Check if assignment exists
    const existing = await db.tenantComponentAssignment.findUnique({
      where: {
        tenantId_componentId: {
          tenantId,
          componentId,
        },
      },
    })

    if (existing) {
      // Update existing assignment
      const updated = await db.tenantComponentAssignment.update({
        where: {
          tenantId_componentId: {
            tenantId,
            componentId,
          },
        },
        data: {
          enabled: body.enabled,
        },
      })
      return NextResponse.json(updated)
    } else {
      // Create new assignment
      const created = await db.tenantComponentAssignment.create({
        data: {
          tenantId,
          componentId,
          enabled: body.enabled,
        },
      })
      return NextResponse.json(created)
    }
  } catch (error) {
    console.error("Error updating component assignment:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}