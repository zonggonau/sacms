import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { triggerWebhooks, WebhookEvents } from "@/lib/webhooks"

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
    // Find all entries that are SCHEDULED and scheduledAt is in the past
    const entries = await db.contentEntry.findMany({
      where: {
        status: "SCHEDULED",
        scheduledAt: {
          lte: new Date(),
        },
      },
      include: {
        contentType: { select: { slug: true } },
      },
    })

    if (entries.length === 0) {
      return NextResponse.json({ published: 0 })
    }

    let published = 0

    for (const entry of entries) {
      try {
        await db.contentEntry.update({
          where: { id: entry.id },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
            scheduledAt: null,
          },
        })

        // Create version
        const lastVersion = await db.contentVersion.findFirst({
          where: { contentEntryId: entry.id },
          orderBy: { version: "desc" },
        })

        await db.contentVersion.create({
          data: {
            contentEntryId: entry.id,
            version: (lastVersion?.version || 0) + 1,
            data: entry.data,
            changeType: "published",
            changedBy: "system",
            changeSummary: "Auto-published by scheduler",
            publishedAt: new Date(),
          },
        })

        // Fire webhook
        triggerWebhooks(entry.tenantId, WebhookEvents.CONTENT_PUBLISHED, {
          entry: {
            id: entry.id,
            contentType: entry.contentType.slug,
            status: "PUBLISHED",
            scheduledPublish: true,
          },
        })

        published++
      } catch (e) {
        console.error(`Failed to publish entry ${entry.id}:`, e)
      }
    }

    return NextResponse.json({
      published,
      total: entries.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Cron publish error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
