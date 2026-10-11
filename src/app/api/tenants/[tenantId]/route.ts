import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { deleteTenantStorage } from "@/lib/r2"
import { dropEnterpriseDb } from "@/lib/enterprise-db"

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenantId } = await params

    // Check if user is owner
    const member = await db.tenantMember.findFirst({
      where: {
        tenantId,
        userId: session.user.id,
        role: "owner"
      },
      include: { tenant: true }
    })

    if (!member && session.user.role !== "super_admin") {
      return NextResponse.json({ error: "Only owners can delete a workspace" }, { status: 403 })
    }

    const tenant = member?.tenant || await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const tenantName = tenant.name
    const tenantSlug = tenant.slug
    const databaseUrl = tenant.databaseUrl

    // Check if tenant has an active paid subscription
    const activeSub = await db.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ["active", "trialing"] },
        plan: { not: "free" }
      }
    })

    if (activeSub) {
      return NextResponse.json({ 
        error: "Cannot delete an active paid workspace. Please cancel your subscription or contact support first." 
      }, { status: 403 })
    }

    // 1. Delete physical assets from storage (R2 or Local)
    if (tenantSlug) {
      await deleteTenantStorage({ id: tenant.id, slug: tenantSlug })
    }

    // 2. Drop dedicated database if exists (Hybrid Multitenancy)
    if (databaseUrl) {
      console.log(`[Tenant Deletion] Dropping dedicated DB for ${tenantSlug}`)
      await dropEnterpriseDb(databaseUrl)
    }

    // 3. Clean up any related child records that lack foreign-key cascade in PostgreSQL
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

    // 4. Delete tenant from master database
    await db.tenant.delete({
      where: { id: tenantId }
    })

    // Log Audit
    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_DELETED,
      entity: "Tenant",
      entityId: tenantId,
      data: { name: tenantName },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting tenant:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
