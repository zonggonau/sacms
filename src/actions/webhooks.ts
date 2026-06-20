"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { revalidatePath } from "next/cache"
import { createWebhookSchema, updateWebhookSchema } from "@/lib/validations"
import { z } from "zod/v4"

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

    if (!membership && session.user.role !== "super_admin") {
      return { error: "Forbidden" }
    }

    const webhooks = await db.webhook.findMany({
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

    if (!membership && session.user.role !== "super_admin") {
      return { error: "Forbidden - Admin access required" }
    }

    const parsed = createWebhookSchema.safeParse(data)
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Validation failed" }
    const { name, url, secret, events, enabled } = parsed.data

    const webhook = await db.webhook.create({
      data: {
        tenantId: tenant.id,
        name,
        url,
        secret: secret || null,
        events: events as any,
        enabled: enabled !== false,
      },
    })

    revalidatePath(`/dashboard/${tenantSlug}/webhooks`)
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

    if (!membership && session.user.role !== "super_admin") {
      return { error: "Forbidden - Admin access required" }
    }

    const webhook = await db.webhook.findFirst({
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

    const updated = await db.webhook.update({
      where: { id: webhookId },
      data: updateData,
    })

    revalidatePath(`/dashboard/${tenantSlug}/webhooks`)
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

    if (!membership && session.user.role !== "super_admin") {
      return { error: "Forbidden - Admin access required" }
    }

    const webhook = await db.webhook.findFirst({
      where: { id: webhookId, tenantId: tenant.id },
    })
    if (!webhook) return { error: "Webhook not found" }

    await db.webhookLog.deleteMany({
      where: { webhookId },
    })

    await db.webhook.delete({
      where: { id: webhookId },
    })

    revalidatePath(`/dashboard/${tenantSlug}/webhooks`)
    return { success: true }
  } catch (error) {
    console.error("Error deleting webhook:", error)
    return { error: "Internal server error" }
  }
}
