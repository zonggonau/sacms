"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { revalidatePath } from "next/cache"
import { createWebhookSchema, updateWebhookSchema } from "@/lib/validations"
import { z } from "zod/v4"
import { isPlatformStaff } from "@/lib/platform-roles"

export async function getWebhooksAction(tenantSlug: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    })
    if (!tenant) return { error: "Tenant not found" }

    const membership = await db.tenantMember.findFirst({
      where: { tenantId: tenant.id, userId: session.user.id },
    })

    if (!membership && !isPlatformStaff(session.user.role)) {
      return { error: "Forbidden" }
    }

    const tenantDb = await getTenantDb(tenant.slug)
    const webhooks = await tenantDb.webhook.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        enabled: true,
        lastTriggeredAt: true,
        failureCount: true,
        createdAt: true,
      },
    })

    return { webhooks }
  } catch (error) {
    console.error("Error fetching webhooks:", error)
    return { error: "Internal server error" }
  }
}

export async function createWebhookAction(tenantSlug: string, data: z.infer<typeof createWebhookSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    })
    if (!tenant) return { error: "Tenant not found" }

    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && !isPlatformStaff(session.user.role)) {
      return { error: "Forbidden - Admin access required" }
    }

    const parsed = createWebhookSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { name, url, secret, events, enabled } = parsed.data

    const tenantDb = await getTenantDb(tenant.slug)
    const webhook = await tenantDb.webhook.create({
      data: {
        tenantId: tenant.id,
        name,
        url,
        secret: secret || null,
        events: events as any,
        enabled: enabled !== false,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { webhook }
  } catch (error) {
    console.error("Error creating webhook:", error)
    return { error: "Internal server error" }
  }
}

export async function updateWebhookAction(tenantSlug: string, webhookId: string, data: z.infer<typeof updateWebhookSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    })
    if (!tenant) return { error: "Tenant not found" }

    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && !isPlatformStaff(session.user.role)) {
      return { error: "Forbidden - Admin access required" }
    }

    const tenantDb = await getTenantDb(tenant.slug)
    const webhook = await tenantDb.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })
    if (!webhook) return { error: "Webhook not found" }

    const parsed = updateWebhookSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { name, url, secret, events, enabled } = parsed.data
    const headers = (parsed.data as Record<string, unknown>).headers

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (url !== undefined) {
      try {
        new URL(url)
        updateData.url = url
      } catch {
        return { error: "Invalid URL" }
      }
    }
    if (secret !== undefined) updateData.secret = secret || null
    if (events !== undefined) updateData.events = events
    if (enabled !== undefined) updateData.enabled = enabled
    if (headers !== undefined) updateData.headers = headers || null

    const updated = await tenantDb.webhook.update({
      where: { id: webhookId },
      data: updateData,
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { webhook: updated }
  } catch (error) {
    console.error("Error updating webhook:", error)
    return { error: "Internal server error" }
  }
}

export async function deleteWebhookAction(tenantSlug: string, webhookId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { error: "Unauthorized" }

    const tenant = await db.tenant.findFirst({
      where: { OR: [{ slug: tenantSlug }, { id: tenantSlug }] },
    })
    if (!tenant) return { error: "Tenant not found" }

    const membership = await db.tenantMember.findFirst({
      where: {
        tenantId: tenant.id,
        userId: session.user.id,
        role: { in: ["owner", "admin"] },
      },
    })

    if (!membership && !isPlatformStaff(session.user.role)) {
      return { error: "Forbidden - Admin access required" }
    }

    const tenantDb = await getTenantDb(tenant.slug)
    const webhook = await tenantDb.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })
    if (!webhook) return { error: "Webhook not found" }

    await tenantDb.webhookLog.deleteMany({
      where: { webhookId },
    })

    await tenantDb.webhook.delete({
      where: { id: webhookId },
    })

    revalidatePath(`/dashboard/${tenantSlug}/developer/webhooks`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return { error: "Internal server error" }
  }
}
