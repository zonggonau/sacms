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
 * Daily: remind 7 days and 1 day before a storage add-on or managed database/storage service
 * ends, and expire managed services whose paid period has passed (IT gets a ticket to disconnect).
 * Each reminder is marked on its row, so running twice a day sends nothing twice.
 */
export async function runBillingReminders(now: Date = new Date()) {
  const result = { storageReminders: 0, managedReminders: 0, managedExpired: 0 }
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
      const link = `${baseUrl}/developer/${tenant?.slug ?? addon.tenantId}/subscriptions?tab=addons`
      await notify(
        addon.tenantId,
        `Extra storage workspace ${tenant?.name ?? ""} berakhir ${label}`,
        `<p>Add-on storage 10 GB untuk workspace <b>${tenant?.name ?? addon.tenantId}</b> berakhir pada ${formatDate(addon.expiresAt)}.</p>` +
          `<p>Setelah itu kuota storage kembali ke kuota paket dan upload baru bisa ditolak bila kuota terlampaui.</p>` +
          `<p><a href="${link}">Perpanjang add-on</a></p>`,
      )
      result.storageReminders++
    }

    const services = await db.managedInfraService.findMany({
      where: { status: { in: ["active", "awaiting_setup"] }, paidUntil: { gt: now, lte: horizon }, [field]: null },
    })
    for (const service of services) {
      const markBoth = field === "reminder1dSentAt" ? { reminder1dSentAt: now, reminder7dSentAt: service.reminder7dSentAt ?? now } : { reminder7dSentAt: now }
      await db.managedInfraService.update({ where: { id: service.id }, data: markBoth })
      const tenant = tenantById.get(service.tenantId)
      const link = `${baseUrl}/developer/${tenant?.slug ?? service.tenantId}/subscriptions?tab=addons`
      await notify(
        service.tenantId,
        `Layanan database & storage sendiri workspace ${tenant?.name ?? ""} berakhir ${label}`,
        `<p>Layanan database & storage sendiri untuk workspace <b>${tenant?.name ?? service.tenantId}</b> dibayar sampai ${formatDate(service.paidUntil)}.</p>` +
          `<p>Bila tidak diperpanjang, tim IT SaCMS akan memutus sambungannya dan workspace kembali memakai infrastruktur bersama.</p>` +
          `<p><a href="${link}">Perpanjang 1 bulan</a></p>`,
      )
      result.managedReminders++
    }
  }

  const expired = await db.managedInfraService.findMany({
    where: { status: { in: ["active", "awaiting_setup"] }, paidUntil: { lte: now } },
  })
  for (const service of expired) {
    await db.managedInfraService.update({ where: { id: service.id }, data: { status: "expired", expiredAt: now } })
    const tenant = tenantById.get(service.tenantId)
    const userId = service.requestedById
    if (userId) {
      await db.supportTicket.create({
        data: {
          tenantId: service.tenantId,
          userId,
          subject: `Putus database & storage sendiri — ${tenant?.name ?? service.tenantId}`,
          category: "infrastructure",
          priority: "high",
          messages: {
            create: {
              senderId: userId,
              senderRole: "system",
              message:
                `Layanan database & storage sendiri workspace ${tenant?.name ?? service.tenantId} ` +
                `(${tenant?.slug ?? service.tenantId}) tidak diperpanjang dan berakhir ${formatDate(service.paidUntil)}.\n\n` +
                `Tugas tim IT: pindahkan data kembali ke infrastruktur bersama bila perlu, lalu kosongkan sambungan ` +
                `database/storage workspace ini.`,
            },
          },
        },
      })
    }
    await notify(
      service.tenantId,
      `Layanan database & storage sendiri workspace ${tenant?.name ?? ""} telah berakhir`,
      `<p>Layanan database & storage sendiri untuk workspace <b>${tenant?.name ?? service.tenantId}</b> berakhir pada ${formatDate(service.paidUntil)}. ` +
        `Tim IT SaCMS akan menghubungi Anda sebelum sambungannya diputus.</p>`,
    )
    result.managedExpired++
  }

  return result
}
