import { db } from "@/lib/database"
import { getBaseUrl, sendBillingNoticeEmail } from "@/lib/mail"

const DAY_MS = 24 * 60 * 60 * 1000

/** Owners and admins of a workspace: who hears about its billing. */
async function billingRecipients(tenantId: string): Promise<string[]> {
  const members = await db.tenantMember.findMany({
    where: { tenantId, role: { in: ["owner", "admin"] } },
    select: { user: { select: { email: true } } },
  })
  return [...new Set(members.map((m) => m.user?.email).filter((e): e is string => Boolean(e)))]
}

async function notify(tenantId: string, subject: string, body: string): Promise<void> {
  const recipients = await billingRecipients(tenantId)
  for (const to of recipients) {
    try {
      await sendBillingNoticeEmail(to, subject, body)
    } catch (error) {
      console.warn(`[billing-reminders] email to workspace ${tenantId} failed:`, (error as Error)?.message)
    }
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Daily: remind 7 days and 1 day before a storage add-on ends. Each
 * reminder is marked on its row, so running twice a day sends nothing
 * twice.
 */
export async function runBillingReminders(now: Date = new Date()) {
  const result = { storageReminders: 0 }
  const in7d = new Date(now.getTime() + 7 * DAY_MS)
  const in1d = new Date(now.getTime() + DAY_MS)

  const tenants = await db.tenant.findMany({ select: { id: true, slug: true, name: true } })
  const tenantById = new Map(tenants.map((t) => [t.id, t]))
  const baseUrl = await getBaseUrl().catch(() => "")

  for (const [field, horizon, label] of [
    ["reminder1dSentAt", in1d, "besok"],
    ["reminder7dSentAt", in7d, "dalam 7 hari"],
  ] as const) {
    const addons = await db.storageAddon.findMany({
      where: { expiresAt: { gt: now, lte: horizon }, [field]: null },
    })
    const renewed = new Set(
      (await db.storageAddon.findMany({
        where: { renewsAddonId: { in: addons.map((a) => a.id) } },
        select: { renewsAddonId: true },
      })).map((a) => a.renewsAddonId),
    )
    for (const addon of addons) {
      const markBoth = field === "reminder1dSentAt" ? { reminder1dSentAt: now, reminder7dSentAt: addon.reminder7dSentAt ?? now } : { reminder7dSentAt: now }
      await db.storageAddon.update({ where: { id: addon.id }, data: markBoth })
      if (renewed.has(addon.id)) continue
      const tenant = tenantById.get(addon.tenantId)
      const link = `${baseUrl}/dashboard/${tenant?.slug ?? addon.tenantId}/subscriptions?tab=addons`
      await notify(
        addon.tenantId,
        `Extra storage workspace ${tenant?.name ?? ""} berakhir ${label}`,
        `<p>Add-on storage 10 GB untuk workspace <b>${tenant?.name ?? addon.tenantId}</b> berakhir pada ${formatDate(addon.expiresAt)}.</p>` +
          `<p>Setelah itu kuota storage kembali ke kuota paket dan upload baru bisa ditolak bila kuota terlampaui.</p>` +
          `<p><a href="${link}">Perpanjang add-on</a></p>`,
      )
      result.storageReminders++
    }
  }

  return result
}
