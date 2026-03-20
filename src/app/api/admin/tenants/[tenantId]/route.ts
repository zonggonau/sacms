import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
  description: z.string().max(500).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            members: true,
            contentTypeAssignments: true,
            singleTypeAssignments: true,
            media: true,
          }
        }
      }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    return NextResponse.json({ tenant })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params
    const result = await validateBody(request, updateTenantSchema)
    if ("error" in result) return result.error

    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data: result.data,
    })

    return NextResponse.json({ tenant })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { tenantId } = await params
    
    // Check if it's the last super admin tenant or something? 
    // Usually we just delete or mark as deleted.
    await db.tenant.delete({
      where: { id: tenantId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
