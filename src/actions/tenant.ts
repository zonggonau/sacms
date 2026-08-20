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
  addons: z.array(z.string()).optional(),
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

    const { name, description, plan = "free", aiPrompt, websiteType, addons = [] } = validation.data

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

      if (addons && addons.length > 0) {
        for (const addonId of addons) {
          await tx.subscription.create({
            data: {
              userId: session.user.id,
              tenantId: newTenant.id,
              plan: addonId,
              status: "active",
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
            }
          })
        }
      }

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

export async function applyTemplateAction(tenantIdOrSlug: string, templateId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const tenant = await db.tenant.findFirst({
      where: {
        OR: [{ id: tenantIdOrSlug }, { slug: tenantIdOrSlug }]
      }
    })

    if (!tenant) return { error: "Tenant not found" }
    const tenantId = tenant.id

    // Check if user is owner or admin of this tenant
    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId,
        userId: session.user.id,
        role: { in: ["owner", "admin"] }
      }
    })

    if (!membership) {
      return { error: "Forbidden: Only workspace owner or admin can apply templates." }
    }

    // Call provisionTenant to apply the template safely (it skips existing slugs)
    await provisionTenant(tenantId, undefined, templateId)

    await logAudit({
      userId: session.user.id,
      tenantId,
      action: AuditAction.CONTENT_UPDATED,
      entity: "schema",
      entityId: tenantId,
      data: { templateId }
    })

    // Revalidate the CTB overview path
    revalidatePath(`/dashboard/${tenant.slug}/content-type-builder/overview`)

    return { success: true }
  } catch (error: any) {
    console.error("[ApplyTemplateAction] Error:", error)
    return { error: error.message || "Failed to apply template" }
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

    const { getGlobalWorkspaceId } = await import("@/lib/settings")
    const globalTenantId = await getGlobalWorkspaceId()
    if ((tenant.slug === globalTenantId || tenant.id === globalTenantId) && session.user.role !== "super_admin") {
      return { error: "Global tenant can only be deleted by Super Admin" }
    }

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

export async function getGlobalWorkspaceIdAction() {
  const { getGlobalWorkspaceId } = await import("@/lib/settings");
  return await getGlobalWorkspaceId();
}

export async function checkWorkspaceAccessAction(targetTenantId?: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { allowed: false, redirectUrl: "/login" }
    }

    const { getTenantAccess } = await import("@/lib/tenant-access")

    // Case 1: Checking access to /dashboard (workspace manager selection page)
    if (!targetTenantId) {
      return { allowed: true, redirectUrl: "/dashboard" }
    }

    // Case 2: Checking access to a specific target tenant workspace
    const access = await getTenantAccess(session, targetTenantId)
    if (!access) {
      return { allowed: false, error: "Access denied. You do not have permission for this workspace." }
    }

    return { allowed: true, redirectUrl: `/dashboard/${access.tenantId}` }
  } catch (error) {
    console.error("Error checking workspace access:", error)
    return { allowed: false, error: "Failed to check workspace access." }
  }
}
