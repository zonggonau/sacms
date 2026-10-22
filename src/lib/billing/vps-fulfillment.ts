import { db } from "@/lib/database"
import { createKeypair, createVm } from "@/lib/biznetgio"
import { randomBytes } from "crypto"

/**
 * VPS purchases are never silently dropped: a paid order always ends with a
 * VpsInstance row, "active" (well, "provisioning" — see the status-refresh
 * flow) on success or "failed" with a reason on any Biznet Gio API error.
 * On failure a support ticket is opened too — the customer already paid,
 * so staff need to either fix the provisioning or refund them, never leave
 * it silent. Mirrors fulfillManagedInfraOrder's openSetupTicket in
 * managed-infra.ts for the same reason.
 */
export async function fulfillVpsOrder(params: {
  ownerId: string
  tenantId: string | null
  orderId: string
  offeringId: string
  billingCycle: "m" | "a"
}): Promise<void> {
  const { ownerId, tenantId, orderId, offeringId, billingCycle } = params

  const offering = await db.vpsOffering.findUnique({ where: { slug: offeringId } })
  if (!offering) {
    // Should be unreachable — checkout already validated the offering
    // exists before accepting payment — but if the offering was deleted in
    // the narrow window between checkout and this fulfillment step, there's
    // no valid offeringId left to satisfy VpsInstance's FK, so this can't
    // create a row. Never drop a paid order silently even so: log loudly
    // and open a ticket for staff to resolve by hand (provision manually or
    // refund).
    console.error(`[VPS] Offering "${offeringId}" not found while fulfilling order ${orderId} — cannot create a VpsInstance row.`)
    await openVpsSupportTicket(ownerId, tenantId, orderId, `Paket VPS "${offeringId}" sudah tidak tersedia saat pesanan ini diproses.`)
    return
  }

  const instance = await db.vpsInstance.create({
    data: {
      offeringId: offering.id,
      ownerId,
      tenantId,
      orderId,
      status: "provisioning",
      billingCycle,
    },
  })

  try {
    const keypair = await createKeypair(`sacms-${instance.id}`)
    const rootPassword = randomBytes(12).toString("base64url")

    const { account_id } = await createVm({
      product_id: offering.biznetProductId,
      cycle: billingCycle,
      select_os: offering.biznetOsImageId,
      keypair_id: keypair.keypair_id,
      ssh_and_console_user: "root",
      console_password: rootPassword,
      vm_name: `sacms-${instance.id}`,
      pay_invoice_with_cc: true,
    })

    await db.vpsInstance.update({
      where: { id: instance.id },
      data: {
        biznetAccountId: account_id,
        biznetKeypairId: keypair.keypair_id,
        rootUser: "root",
        rootPassword,
        // Still "provisioning" — Biznet Gio's own VM boot isn't instant and
        // this session never confirmed how long it actually takes (no live
        // createVm call was made while building this). The owner/tenant
        // status view's "Refresh Status" button is what moves this to
        // "active" once getVmDetails() actually returns an IP.
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[VPS] Provisioning failed for order ${orderId}:`, err)
    await db.vpsInstance.update({
      where: { id: instance.id },
      data: { status: "failed", failureReason: message },
    })
    await openVpsSupportTicket(ownerId, tenantId, orderId, message)
  }
}

async function openVpsSupportTicket(ownerId: string, tenantId: string | null, orderId: string, reason: string): Promise<void> {
  await db.supportTicket.create({
    data: {
      tenantId,
      userId: ownerId,
      subject: `Provisioning VPS gagal — order ${orderId}`,
      category: "infrastructure",
      priority: "high",
      messages: {
        create: {
          senderId: ownerId,
          senderRole: "system",
          message:
            `Pelanggan sudah membayar VPS (order ${orderId}) tapi provisioning via Biznet Gio gagal.\n\n` +
            `Error: ${reason}\n\n` +
            `Tugas tim: cek akun Biznet Gio SaCMS (saldo/metode pembayaran, kuota region), coba provisioning ulang secara manual, atau proses refund jika tidak bisa dipenuhi.`,
        },
      },
    },
  }).catch((e) => console.error("[VPS] Failed to open support ticket:", e))
}
