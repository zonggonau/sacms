import { NextResponse } from "next/server"
import { db, getTenantDbById } from "@/lib/database"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"
import { invalidatePattern } from "@/lib/cache"

/**
 * GET /api/cron/publish
 * Cron job to auto-publish scheduled content entries.
 * Called by Vercel Cron every 5 minutes.
 *
 * Requires CRON_SECRET header for security.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. Get all tenants to iterate through their databases
    const tenants = await db.tenant.findMany({
      select: { id: true, slug: true, databaseUrl: true }
    })

    let totalPublished = 0
    let totalScanned = 0
    const results: Record<string, number> = {}

    const now = new Date()

    for (const tenant of tenants) {
      try {
        const tenantDb = await getTenantDbById(tenant.id)
        
        // Find all entries that are SCHEDULED and scheduledAt is in the past for this specific tenant
        const entries = await tenantDb.contentEntry.findMany({
          where: {
            tenantId: tenant.id,
            status: "SCHEDULED",
            scheduledAt: {
              lte: now,
            },
          },
          include: {
            // Need to join with Master DB's contentType definition
            // Actually, in SaCMS, contentType is currently only in Master DB
            // but let's assume it's available or we can look it up
          },
        })

        if (entries.length === 0) continue

        let publishedInTenant = 0
        for (const entry of entries) {
          // Resolve content type slug (lookup from Master DB)
          const contentType = await db.contentType.findUnique({
            where: { id: entry.contentTypeId },
            select: { slug: true }
          })

          if (!contentType) continue

          await tenantDb.contentEntry.update({
            where: { id: entry.id },
            data: {
              status: "PUBLISHED",
              publishedAt: now,
              scheduledAt: null,
            },
          })

          // Create version in tenant DB
          const lastVersion = await tenantDb.contentVersion.findFirst({
            where: { contentEntryId: entry.id },
            orderBy: { version: "desc" },
          })

          await tenantDb.contentVersion.create({
            data: {
              contentEntryId: entry.id,
              version: (lastVersion?.version || 0) + 1,
              data: entry.data as any,
              changeType: "published",
              changedBy: "system",
              changeSummary: "Auto-published by scheduler",
              publishedAt: now,
            },
          })

          // Fire webhook
          triggerWebhooks(tenant.id, WebhookEvents.CONTENT_PUBLISHED, {
            entry: {
              id: entry.id,
              contentType: contentType.slug,
              status: "PUBLISHED",
              scheduledPublish: true,
            },
          })

          // Invalidate Public API Cache
          invalidatePattern(`public_api:${tenant.slug}:${contentType.slug}:*`).catch(() => {})

          publishedInTenant++
        }

        if (publishedInTenant > 0) {
          totalPublished += publishedInTenant
          results[tenant.slug] = publishedInTenant
        }
        totalScanned += entries.length

      } catch (err) {
        console.error(`Cron: Failed to process tenant ${tenant.slug}:`, err)
      }
    }

    return NextResponse.json({
      success: true,
      published: totalPublished,
      scanned: totalScanned,
      details: results,
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("Cron publish error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
