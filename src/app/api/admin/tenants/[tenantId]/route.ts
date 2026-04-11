import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { deleteTenantStorage } from "@/lib/r2"
import { dropEnterpriseDb } from "@/lib/enterprise-db"

const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["active", "suspended", "deleted"]).optional(),
  plan: z.enum(["free", "starter", "pro", "enterprise"]).optional(),
  description: z.string().max(500).optional().nullable(),
  databaseUrl: z.string().url().optional().or(z.literal("")).nullable(),
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
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        databaseUrl: true,
        description: true,
        createdAt: true,
        updatedAt: true,
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

    const data = { ...result.data }
    if (data.databaseUrl === "") data.databaseUrl = null

    const tenant = await db.tenant.update({
      where: { id: tenantId },
      data,
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
    
    // Get tenant info for cleanup
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // 1. Delete physical assets from storage (R2 or Local)
    if (tenant.slug) {
      await deleteTenantStorage(tenant.slug)
    }

    // 2. Drop dedicated database if exists (Hybrid Multitenancy)
    if (tenant.databaseUrl) {
      console.log(`[Admin Tenant Deletion] Dropping dedicated DB for ${tenant.slug}`)
      await dropEnterpriseDb(tenant.databaseUrl)
    }

    // 3. Delete tenant from master database (Cascade will handle members, entries, etc.)
    await db.tenant.delete({
      where: { id: tenantId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in admin tenant deletion:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
