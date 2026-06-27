"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { randomBytes } from "crypto"
import { provisionTenant } from "@/lib/tenant-provisioning"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { deleteTenantStorage } from "@/lib/r2"
import { dropEnterpriseDb } from "@/lib/enterprise-db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  plan: z.string().optional(),
  aiPrompt: z.string().max(2000).optional(),
  websiteType: z.string().optional(),
})

async function generateUniqueSlug(): Promise<string> {
  const slug = randomBytes(8).toString("hex") // 16 characters
  const existing = await db.tenant.findUnique({ where: { slug } })
  if (existing) {
    return generateUniqueSlug()
  }
  return slug
}

export async function createTenantAction(data: any) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const { enforceUserPlanLimit, validateWorkspacePlanBinding } = await import("@/lib/plan-enforcement")
    const { getUserPlanConfig } = await import("@/lib/tenant-plan")
    
    const workspaceEnforcement = await enforceUserPlanLimit(session.user.id, "workspaces")
    if (!workspaceEnforcement.allowed) {
      return { error: workspaceEnforcement.message }
    }

    const validation = createTenantSchema.safeParse(data)
    if (!validation.success) {
      return { error: "Invalid data provided." }
    }

    const { name, description, plan = "free", aiPrompt, websiteType } = validation.data

    const userPlan = await getUserPlanConfig(session.user.id)
    const planBinding = validateWorkspacePlanBinding(workspaceEnforcement.planSlug, plan)
    if (!planBinding.allowed) {
      return { error: planBinding.message }
    }

    const slug = await generateUniqueSlug()

    const tenant = await db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          description,
          plan,
          status: "provisioning",
        }
      })

      await tx.tenantMember.create({
        data: {
          tenantId: newTenant.id,
          userId: session.user.id,
          role: "owner",
        }
      })

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

    // Run provisioning in background
    provisionTenant(tenant.id, aiPrompt, websiteType).catch(err => {
      console.error(`[Server Action Provisioning Error] ${tenant.id}:`, err)
    })

    await logAudit({
      tenantId: tenant.id,
      userId: session.user.id,
      action: AuditAction.TENANT_CREATED,
      entity: "Tenant",
      entityId: tenant.id,
      data: { name, slug },
    })

    revalidatePath("/dashboard")
    return { success: true, tenantId: tenant.id }
  } catch (error) {
    console.error("Error creating tenant:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteTenantAction(tenantId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const member = await db.tenantMember.findFirst({
      where: {
        tenantId,
        userId: session.user.id,
        role: "owner"
      },
      include: { tenant: true }
    })

    if (!member && session.user.role !== "super_admin") {
      return { error: "Only owners can delete a workspace" }
    }

    const tenant = member?.tenant || await db.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) return { error: "Tenant not found" }

    const activeSub = await db.subscription.findFirst({
      where: {
        tenantId,
        status: { in: ["active", "trialing"] },
        plan: { not: "free" }
      }
    })

    if (activeSub) {
      return { error: "Cannot delete an active paid workspace. Please cancel your subscription or contact support first." }
    }

    if (tenant.slug) {
      await deleteTenantStorage(tenant.slug)
    }

    if (tenant.databaseUrl) {
      await dropEnterpriseDb(tenant.databaseUrl)
    }

    await db.tenant.delete({
      where: { id: tenantId }
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.TENANT_DELETED,
      entity: "Tenant",
      entityId: tenantId,
      data: { name: tenant.name },
    })

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Error deleting tenant:", error)
    return { error: "Internal server error" }
  }
}
