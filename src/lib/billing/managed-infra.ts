import { db } from "@/lib/database"
import { addOneMonth } from "./storage-addon"

/**
 * Own database and/or storage for a workspace (BYODB/BYOS) as a managed service: the
 * customer orders and pays, the SaCMS IT team sets up the server and connects it to the
 * workspace. Nothing is provisioned automatically.
 *
 *   order "setup"   → setup fee + first month → service `awaiting_setup` + support ticket
 *   IT connects     → Database & Storage settings saved by a super admin → `active`
 *   order "monthly" → one more month on `paidUntil`
 *   paidUntil passes without renewal → `expired` + ticket for IT to disconnect
 */

export const MANAGED_INFRA_SETUP_ID = "managed_byodb_setup"
export const MANAGED_INFRA_MONTHLY_ID = "managed_byodb_monthly"
export const MANAGED_INFRA_SETUP_FEE_IDR = 2_500_000
export const MANAGED_INFRA_MONTHLY_FEE_IDR = 1_000_000

export function isManagedInfraProduct(productId: string): boolean {
  return productId === MANAGED_INFRA_SETUP_ID || productId === MANAGED_INFRA_MONTHLY_ID
}

/** Why `productId` cannot be ordered for this workspace now, or null when it can. */
export async function managedInfraOrderRefusal(tenantId: string, productId: string): Promise<string | null> {
  const service = await db.managedInfraService.findUnique({ where: { tenantId } })
  if (productId === MANAGED_INFRA_SETUP_ID) {
    if (service && (service.status === "awaiting_setup" || service.status === "active")) {
      return "Layanan database & storage sendiri sudah dipesan untuk workspace ini. Perpanjang bulanan bila perlu."
    }
    return null
  }
  if (productId === MANAGED_INFRA_MONTHLY_ID) {
    if (!service || service.status === "cancelled") {
      return "Pesan layanan database & storage sendiri terlebih dahulu sebelum memperpanjang."
    }
    return null
  }
  return "Produk layanan tidak dikenal."
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002"
}

/**
 * Apply a paid order. Idempotent per order: the payment row is created inside the same
 * transaction that moves `paidUntil`, so a second delivery of the same order changes nothing.
 */
export async function fulfillManagedInfraOrder(params: {
  tenantId: string
  orderId: string
  productId: string
  userId?: string | null
  now?: Date
}): Promise<{ applied: boolean }> {
  const { tenantId, orderId, productId, userId } = params
  const now = params.now ?? new Date()
  if (!isManagedInfraProduct(productId)) return { applied: false }

  let createdTicketFor: { serviceId: string } | null = null
  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.managedInfraService.findUnique({ where: { tenantId } })

      if (productId === MANAGED_INFRA_SETUP_ID) {
        const periodEnd = addOneMonth(now)
        const service = await tx.managedInfraService.upsert({
          where: { tenantId },
          create: { tenantId, status: "awaiting_setup", paidUntil: periodEnd, requestedById: userId ?? null },
          update: {
            status: "awaiting_setup",
            paidUntil: periodEnd,
            requestedById: userId ?? null,
            activatedAt: null,
            expiredAt: null,
            reminder7dSentAt: null,
            reminder1dSentAt: null,
          },
        })
        await tx.managedInfraPayment.create({
          data: {
            serviceId: service.id,
            orderId,
            kind: "setup",
            amount: MANAGED_INFRA_SETUP_FEE_IDR + MANAGED_INFRA_MONTHLY_FEE_IDR,
            periodStart: now,
            periodEnd,
          },
        })
        createdTicketFor = { serviceId: service.id }
        return
      }

      if (!existing) throw new Error(`No managed database/storage service for tenant ${tenantId}`)
      const periodStart = existing.paidUntil > now ? existing.paidUntil : now
      const periodEnd = addOneMonth(periodStart)
      await tx.managedInfraPayment.create({
        data: {
          serviceId: existing.id,
          orderId,
          kind: "monthly",
          amount: MANAGED_INFRA_MONTHLY_FEE_IDR,
          periodStart,
          periodEnd,
        },
      })
      const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { databaseUrl: true, storageConfig: true } })
      const connected = Boolean(tenant?.databaseUrl || tenant?.storageConfig)
      await tx.managedInfraService.update({
        where: { id: existing.id },
        data: {
          paidUntil: periodEnd,
          status: existing.status === "expired" ? (connected ? "active" : "awaiting_setup") : existing.status,
          expiredAt: null,
          reminder7dSentAt: null,
          reminder1dSentAt: null,
        },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) return { applied: false }
    throw error
  }

  if (createdTicketFor && userId) {
    await openSetupTicket(tenantId, userId, (createdTicketFor as { serviceId: string }).serviceId)
  }
  return { applied: true }
}

async function openSetupTicket(tenantId: string, userId: string, serviceId: string): Promise<void> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } })
  const ticket = await db.supportTicket.create({
    data: {
      tenantId,
      userId,
      subject: `Setup database & storage sendiri — ${tenant?.name ?? tenantId}`,
      category: "infrastructure",
      priority: "high",
      messages: {
        create: {
          senderId: userId,
          senderRole: "system",
          message:
            `Pelanggan sudah membayar layanan database & storage sendiri untuk workspace ` +
            `${tenant?.name ?? tenantId} (${tenant?.slug ?? tenantId}).\n\n` +
            `Tugas tim IT: siapkan server (PostgreSQL dan/atau S3), terapkan skema SaCMS dengan prisma db push, ` +
            `lalu sambungkan di Database & Storage workspace ini sebagai super admin. Status layanan berubah ` +
            `menjadi aktif begitu koneksi disimpan.`,
        },
      },
    },
  })
  await db.managedInfraService.update({ where: { id: serviceId }, data: { ticketId: ticket.id } })
}

/** Called when a super admin saves the workspace's own database/storage connection. */
export async function activateManagedInfraIfConnected(tenantId: string, connected: boolean): Promise<void> {
  if (!connected) return
  await db.managedInfraService.updateMany({
    where: { tenantId, status: "awaiting_setup" },
    data: { status: "active", activatedAt: new Date() },
  })
}
