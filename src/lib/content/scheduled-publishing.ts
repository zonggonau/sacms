import { db, getTenantDbById, Prisma } from "@/lib/database"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { invalidateContentCaches } from "./entry-service"

export async function publishScheduledContent({ dryRun = false } = {}) {
  const now = new Date()
  const tenants = await db.tenant.findMany({ where: { status: "active" }, select: { id: true, slug: true } })
  let published = 0
  let scanned = 0
  let failed = 0
  const details: Record<string, number> = {}

  for (const tenant of tenants) {
    try {
      const client = await getTenantDbById(tenant.id)
      const entries = await client.contentEntry.findMany({
        where: { tenantId: tenant.id, status: "SCHEDULED", deletedAt: null, scheduledAt: { lte: now } },
        select: {
          id: true,
          updatedAt: true,
          data: true,
          contentType: { select: { slug: true } },
        },
      })
      scanned += entries.length
      if (dryRun) continue

      for (const entry of entries) {
        try {
          const applied = await client.$transaction(async (tx) => {
            const claimed = await tx.contentEntry.updateMany({
              where: {
                id: entry.id,
                tenantId: tenant.id,
                updatedAt: entry.updatedAt,
                status: "SCHEDULED",
                deletedAt: null,
                scheduledAt: { lte: now },
              },
              data: { status: "PUBLISHED", scheduledAt: null, publishedAt: now },
            })
            if (!claimed.count) return false
            const lastVersion = await tx.contentVersion.findFirst({
              where: { contentEntryId: entry.id },
              orderBy: { version: "desc" },
            })
            await tx.contentVersion.create({
              data: {
                contentEntryId: entry.id,
                version: (lastVersion?.version ?? 0) + 1,
                data: entry.data === null ? Prisma.JsonNull : entry.data,
                changeType: "published",
                changedBy: "system",
                changeSummary: "Auto-published by scheduler",
                publishedAt: now,
              },
            })
            return true
          })
          if (!applied) continue
          const slug = entry.contentType.slug
          details[tenant.slug] = (details[tenant.slug] ?? 0) + 1
          published++
          await invalidateContentCaches(tenant.slug, slug, tenant.id)
          await triggerWebhooks(tenant.id, WebhookEvents.CONTENT_PUBLISHED, {
            entry: { id: entry.id, contentType: slug, status: "PUBLISHED", scheduledPublish: true },
          })
        } catch (error) {
          failed++
          console.error(`[scheduled publish] Entry ${entry.id} failed:`, error)
        }
      }
    } catch (error) {
      failed++
      console.error(`[scheduled publish] Workspace ${tenant.slug} failed:`, error)
    }
  }

  return { success: failed === 0, published, scanned, failed, details, timestamp: now.toISOString() }
}
