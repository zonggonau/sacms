import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { validateBody } from "@/lib/validate"
import { z } from "zod/v4"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { randomBytes } from "crypto"
import { provisionTenant } from "@/lib/tenant-provisioning"
import { slugify } from "@/lib/slug"
import { getUserPlanConfig } from "@/lib/tenant-plan"

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  plan: z.string().optional(),
  aiPrompt: z.string().max(2000).optional(),
  websiteType: z.string().optional(),
})

async function generateUniqueSlug(): Promise<string> {
  const slug = randomBytes(8).toString("hex") // 16 characters
  
  // Check if slug already exists
  const existing = await db.tenant.findUnique({ where: { slug } })
  
  if (existing) {
    return generateUniqueSlug()
  }
  
  return slug
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tenants = await db.tenant.findMany({
      where: {
        members: { some: { userId: session.user.id } }
      },
      include: {
        members: {
          where: { userId: session.user.id },
          select: { role: true }
        },
        subscriptions: {
          where: { status: { in: ["active", "trialing"] } },
          orderBy: { currentPeriodEnd: "desc" },
          take: 1
        }
      },
      orderBy: { createdAt: "desc" }
    })

    const formattedTenants = tenants.map(t => {
      const sub = t.subscriptions[0]
      let daysRemaining = null
      
      if (sub?.currentPeriodEnd) {
        const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        plan: t.plan,
        createdAt: t.createdAt,
        role: t.members[0]?.role || 'member',
        daysRemaining,
        expiresAt: sub?.currentPeriodEnd || null
      }
    })

    return NextResponse.json({ tenants: formattedTenants })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Check workspace limit
    const userPlan = await getUserPlanConfig(session.user.id)
    const ownedWorkspaces = await db.tenantMember.count({
      where: { userId: session.user.id, role: "owner" }
    })

    if (ownedWorkspaces >= userPlan.max_workspaces) {
      return NextResponse.json({ 
        error: `Limit reached. Your ${userPlan.plan_slug} plan allows maximum ${userPlan.max_workspaces} workspaces.` 
      }, { status: 403 })
    }

    const result = await validateBody(request, createTenantSchema)
    if ("error" in result) return result.error
    const { name, description, plan = "free", aiPrompt, websiteType } = result.data

    const slug = await generateUniqueSlug()

    const tenant = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          description,
          plan,
          status: "active",
        }
      })

      await tx.tenantMember.create({
        data: {
          tenantId: newTenant.id,
          userId: session.user.id,
          role: "owner",
        }
      })

      // Create initial subscription
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      await tx.subscription.create({
        data: {
          userId: session.user.id,
          tenantId: newTenant.id,
          plan,
          status: plan === "free" ? "active" : "trialing",
          currentPeriodStart: new Date(),
          currentPeriodEnd: plan === "free" ? null : trialEndDate,
        }
      })

      return newTenant
    })

    // Provision default content types and demo data
    await provisionTenant(tenant.id, aiPrompt, websiteType)

    await logAudit({
      tenantId: tenant.id,
      userId: session.user.id,
      action: AuditAction.TENANT_CREATED,
      entity: "Tenant",
      entityId: tenant.id,
      data: { name, slug },
    })

    return NextResponse.json({ tenant }, { status: 201 })
  } catch (error) {
    console.error("Error creating tenant:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
