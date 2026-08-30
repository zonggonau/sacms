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

    if (tenant.slug === "sacms-global" || tenant.slug === "sacms" || tenant.id === "sacms-global" || tenant.name.toLowerCase() === "sacms global") {
      return NextResponse.json({ error: "Cannot delete global tenant" }, { status: 400 })
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

    // 3. Delete v0.dev project if exists
    const v0Setting = await db.setting.findFirst({
      where: { key: `${tenantId}_v0ChatId` }
    })
    
    if (v0Setting?.value) {
      try {
        console.log(`[Admin Tenant Deletion] Deleting v0.dev chat ${v0Setting.value} for ${tenant.slug}`)
        const { v0 } = await import("v0")
        await v0.chats.delete({ chatId: v0Setting.value })
      } catch (err) {
        console.error(`Failed to delete v0.dev chat ${v0Setting.value}:`, err)
      }
    }

    // 4. Clean up any related child records that lack foreign-key cascade in PostgreSQL
    const tenantSubscriptions = await db.subscription.findMany({
      where: { tenantId },
      select: { id: true }
    })
    const subIds = tenantSubscriptions.map(s => s.id)

    if (subIds.length > 0) {
      await db.paymentTransaction.deleteMany({
        where: { subscriptionId: { in: subIds } }
      }).catch(err => console.warn("Failed to clean up subscription payment transactions:", err))

      await db.invoice.deleteMany({
        where: { subscriptionId: { in: subIds } }
      }).catch(err => console.warn("Failed to clean up subscription invoices:", err))
    }

    // Clean up custom plan overrides
    await db.customPlanOverride.deleteMany({
      where: { tenantId }
    }).catch(err => console.warn("Failed to clean up custom plan overrides:", err))

    // Clean up infrastructure credentials if any
    const infraServers = await db.infrastructureServer.findMany({
      where: { tenantId },
      select: { id: true }
    })
    const serverIds = infraServers.map(s => s.id)
    if (serverIds.length > 0) {
      await db.infrastructureCredential.deleteMany({
        where: { serverId: { in: serverIds } }
      }).catch(err => console.warn("Failed to clean up infrastructure credentials:", err))
    }

    // 5. Delete tenant from master database
    await db.tenant.delete({
      where: { id: tenantId }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in admin tenant deletion:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
