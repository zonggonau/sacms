"use server"

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { randomBytes } from "crypto"

const orderVpsSchema = z.object({
  planSlug: z.string().min(1),
  planName: z.string().min(1),
  serverName: z.string().min(2).max(100),
  billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
  pricePaid: z.number().nonnegative(),
  specs: z.any().optional(),
  notes: z.string().max(1000).optional(),
})

const setupVpsSchema = z.object({
  serviceId: z.string().min(1),
  serverIp: z.string().min(5),
  databaseUrl: z.string().min(10),
  adminNotes: z.string().max(1000).optional(),
})

export async function orderVpsAction(data: z.infer<typeof orderVpsSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    const validation = orderVpsSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: "Data pesanan tidak valid. Periksa kembali form isian." }
    }

    const { planSlug, planName, serverName, billingCycle, pricePaid, specs, notes } = validation.data

    const now = new Date()
    const paidUntil = new Date(now)
    if (billingCycle === "yearly") {
      paidUntil.setFullYear(paidUntil.getFullYear() + 1)
    } else {
      paidUntil.setMonth(paidUntil.getMonth() + 1)
    }

    const orderId = `VPS-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`

    // 1. Buat Tiket Bantuan untuk IT Support
    const ticket = await db.supportTicket.create({
      data: {
        userId: session.user.id,
        subject: `Setup Server VPS: ${serverName} (${planName})`,
        category: "infrastructure",
        priority: "high",
        status: "open",
        messages: {
          create: {
            senderId: session.user.id,
            senderRole: "system",
            message:
              `Pesanan layanan VPS telah berhasil dibayarkan.\n\n` +
              `Detail Pesanan:\n` +
              `• ID Transaksi: ${orderId}\n` +
              `• Paket Server: ${planName} (${planSlug})\n` +
              `• Nama Server: ${serverName}\n` +
              `• Siklus Tagihan: ${billingCycle === "yearly" ? "Tahunan (12 Bulan)" : "Bulanan"}\n` +
              `• Biaya: Rp ${pricePaid.toLocaleString("id-ID")}\n` +
              `• Catatan Permintaan Khusus: ${notes?.trim() || "Tidak ada catatan khusus."}\n\n` +
              `Tugas Tim IT Support:\n` +
              `1. Siapkan instans server VPS terisolasi (PostgreSQL 17 & Storage NVMe).\n` +
              `2. Konfigurasi alamat IP gateway & credential database terenkripsi.\n` +
              `3. Masukkan IP Server & Connection URL Database pada panel manajemen server untuk mengaktifkan status server menjadi 'Siap Digunakan'.`,
          },
        },
      },
    })

    // 2. Buat Record Layanan VPS Pengguna
    const vpsService = await db.userVpsService.create({
      data: {
        userId: session.user.id,
        planSlug,
        planName,
        serverName: serverName.trim(),
        billingCycle,
        pricePaid,
        specs: specs || {},
        notes: notes?.trim() || null,
        ticketId: ticket.id,
        status: "awaiting_setup",
        paidUntil,
      },
    })

    // 3. Catat Transaksi Pembayaran
    await db.paymentTransaction.create({
      data: {
        orderId,
        amount: pricePaid,
        status: "settlement",
        rawResponse: {
          type: "VPS_SERVICE_PURCHASE",
          vpsServiceId: vpsService.id,
          planSlug,
          planName,
          serverName,
          billingCycle,
          pricePaid,
        } as any,
      },
    })

    // 4. Audit Log
    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        orderId,
        vpsServiceId: vpsService.id,
        planSlug,
        serverName,
        pricePaid,
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")

    return {
      success: true,
      serviceId: vpsService.id,
      ticketId: ticket.id,
      orderId,
    }
  } catch (error: any) {
    console.error("[orderVpsAction Error]:", error)
    return { success: false, error: error.message || "Terjadi kesalahan saat memproses pesanan VPS." }
  }
}

export async function setupVpsAction(data: z.infer<typeof setupVpsSchema>) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    const validation = setupVpsSchema.safeParse(data)
    if (!validation.success) {
      return { success: false, error: "Data setup VPS tidak valid." }
    }

    const { serviceId, serverIp, databaseUrl, adminNotes } = validation.data

    const service = await db.userVpsService.findUnique({
      where: { id: serviceId },
      include: { user: true },
    })

    if (!service) {
      return { success: false, error: "Layanan VPS tidak ditemukan." }
    }

    // Hanya Super Admin atau pemilik akun (dalam mode simulasi developer) yang boleh setup
    const isSuperAdmin = session.user.role === "super_admin"
    const isOwner = service.userId === session.user.id
    if (!isSuperAdmin && !isOwner) {
      return { success: false, error: "Anda tidak memiliki izin untuk mengonfigurasi server ini." }
    }

    // Perbarui record VPS
    const updated = await db.userVpsService.update({
      where: { id: serviceId },
      data: {
        serverIp: serverIp.trim(),
        databaseUrl: databaseUrl.trim(),
        status: "ready",
      },
    })

    // Perbarui atau kirim pesan di Support Ticket jika ada
    if (service.ticketId) {
      try {
        await db.supportMessage.create({
          data: {
            ticketId: service.ticketId,
            senderId: session.user.id,
            senderRole: isSuperAdmin ? "admin" : "system",
            message:
              `✅ [Konfigurasi IT Support Selesai]\n\n` +
              `Server VPS '${service.serverName}' telah siap beroperasi dan terisolasi.\n` +
              `• IP Server: ${serverIp.trim()}\n` +
              `• Database PostgreSQL 17: Terhubung & Aktif\n` +
              `• Catatan Setup: ${adminNotes?.trim() || "Konfigurasi server berhasil diselesaikan. Anda sekarang dapat membuat workspace baru dan memilih server VPS ini."}\n\n` +
              `Status layanan kini telah berubah menjadi 'Siap Digunakan'.`,
          },
        })

        await db.supportTicket.update({
          where: { id: service.ticketId },
          data: { status: "resolved" },
        })
      } catch (err) {
        console.warn("[setupVpsAction] Warning adding ticket update message:", err)
      }
    }

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        vpsServiceId: serviceId,
        serverIp,
        action: "VPS_PROVISIONED_READY",
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")

    return { success: true, service: updated }
  } catch (error: any) {
    console.error("[setupVpsAction Error]:", error)
    return { success: false, error: error.message || "Gagal mengonfigurasi setup server VPS." }
  }
}

export async function getUserVpsServicesAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return { success: false, error: "Unauthorized", services: [] }

    const services = await db.userVpsService.findMany({
      where: { userId: session.user.id },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return { success: true, services }
  } catch (error: any) {
    console.error("[getUserVpsServicesAction Error]:", error)
    return { success: false, error: error.message, services: [] }
  }
}

/**
 * Mengambil daftar live Compute Instances langsung dari Contabo API
 */
export async function fetchContaboInstancesAction() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali.", instances: [] }
    }

    if (session.user.role !== "super_admin") {
      return { success: false, error: "Akses ditolak. Fitur ini khusus untuk Super Admin.", instances: [] }
    }

    const { getContaboInstances } = await import("@/lib/contabo")
    const result = await getContaboInstances()

    if (!result.success) {
      return { success: false, error: result.error || "Gagal mengambil data dari Contabo API", instances: [] }
    }

    return { success: true, instances: result.data }
  } catch (error: any) {
    console.error("[fetchContaboInstancesAction Error]:", error)
    return { success: false, error: error.message, instances: [] }
  }
}

/**
 * Menghubungkan / mendaftarkan instance Contabo yang ada ke dalam daftar UserVpsService
 * sehingga langsung berstatus 'ready' dan dapat digunakan untuk membuat Workspace baru.
 */
export async function importContaboInstanceAction(data: {
  instanceId: number
  serverName: string
  serverIp: string
  productId?: string
  productName?: string
  cpuCores?: number
  ramMb?: number
  diskMb?: number
  databaseUrl?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    if (!data.serverIp) {
      return { success: false, error: "IP server Contabo tidak valid." }
    }

    // Cek apakah server IP ini sudah pernah di-import
    const existing = await db.userVpsService.findFirst({
      where: {
        userId: session.user.id,
        serverIp: data.serverIp,
      },
    })

    if (existing) {
      // Update jika sudah ada
      const updated = await db.userVpsService.update({
        where: { id: existing.id },
        data: {
          serverName: data.serverName,
          status: "ready",
          databaseUrl: data.databaseUrl || existing.databaseUrl || `postgresql://postgres:password@${data.serverIp}:5432/sacms_db?schema=public`,
          specs: {
            contaboInstanceId: data.instanceId,
            cpuCores: data.cpuCores,
            ramMb: data.ramMb,
            diskMb: data.diskMb,
            productName: data.productName,
          },
        },
      })
      revalidatePath("/dashboard")
      revalidatePath("/dashboard/services")
      return { success: true, service: updated, message: "Instance Contabo berhasil diperbarui & siap digunakan." }
    }

    const paidUntil = new Date()
    paidUntil.setFullYear(paidUntil.getFullYear() + 1)

    const newService = await db.userVpsService.create({
      data: {
        userId: session.user.id,
        planSlug: (data.productId || "contabo-vps").toLowerCase(),
        planName: data.productName || `Contabo ${data.serverName}`,
        serverName: data.serverName,
        serverIp: data.serverIp,
        billingCycle: "yearly",
        pricePaid: 0,
        status: "ready",
        databaseUrl: data.databaseUrl || `postgresql://postgres:password@${data.serverIp}:5432/sacms_db?schema=public`,
        specs: {
          contaboInstanceId: data.instanceId,
          cpuCores: data.cpuCores,
          ramMb: data.ramMb,
          diskMb: data.diskMb,
          productName: data.productName,
        },
        notes: `Imported directly from Contabo Compute API (Instance ID: ${data.instanceId})`,
        paidUntil,
      },
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        vpsServiceId: newService.id,
        serverIp: data.serverIp,
        action: "CONTABO_INSTANCE_IMPORTED",
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")

    return { success: true, service: newService, message: "Instance Contabo berhasil dihubungkan & siap digunakan untuk Workspace." }
  } catch (error: any) {
    console.error("[importContaboInstanceAction Error]:", error)
    return { success: false, error: error.message || "Gagal menghubungkan instance Contabo." }
  }
}

/**
 * Menghubungkan VPS yang sudah 'ready' ke Workspace ID milik pelanggan
 */
export async function assignVpsToWorkspaceAction(data: {
  serviceId: string
  tenantId: string
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    const isSuperAdmin = session.user.role === "super_admin"

    // 1. Verifikasi VPS
    const vps = await db.userVpsService.findUnique({
      where: { id: data.serviceId },
    })
    if (!vps) {
      return { success: false, error: "Layanan VPS tidak ditemukan." }
    }
    if (!isSuperAdmin && vps.userId !== session.user.id) {
      return { success: false, error: "Anda tidak memiliki hak atas layanan VPS ini." }
    }

    // 2. Verifikasi hak akses ke tenant/workspace
    const tenant = await db.tenant.findUnique({
      where: { id: data.tenantId },
      include: {
        members: { where: { userId: session.user.id } }
      }
    })
    if (!tenant) {
      return { success: false, error: "Workspace tujuan tidak ditemukan." }
    }
    const isOwnerOrAdmin = isSuperAdmin || tenant.ownerId === session.user.id || tenant.members.some((m: any) => m.role === "owner" || m.role === "admin")
    if (!isOwnerOrAdmin) {
      return { success: false, error: "Anda tidak memiliki izin mengelola server untuk workspace ini." }
    }

    // 3. Update database: pasang VPS ke tenant dan perbarui tenant.databaseUrl
    const updatedService = await db.$transaction(async (tx) => {
      // Lepaskan VPS sebelumnya dari tenant ini jika ada
      await tx.userVpsService.updateMany({
        where: { tenantId: tenant.id, id: { not: vps.id } },
        data: { tenantId: null, status: "ready" }
      })

      const updated = await tx.userVpsService.update({
        where: { id: vps.id },
        data: {
          tenantId: tenant.id,
          status: "in_use",
        }
      })

      if (vps.databaseUrl) {
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { databaseUrl: vps.databaseUrl }
        })
      }

      return updated
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        vpsServiceId: vps.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        action: "VPS_ASSIGNED_TO_WORKSPACE",
      }
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")
    revalidatePath(`/dashboard/${tenant.slug || tenant.id}`)

    return {
      success: true,
      service: updatedService,
      message: `Server VPS ${vps.serverName} berhasil dihubungkan ke workspace ${tenant.name}.`
    }
  } catch (error: any) {
    console.error("[assignVpsToWorkspaceAction Error]:", error)
    return { success: false, error: error.message || "Gagal menghubungkan VPS ke workspace." }
  }
}

/**
 * Memutuskan hubungan VPS dari Workspace (kembali ke Shared Pool)
 */
export async function disconnectVpsFromWorkspaceAction(data: { serviceId: string }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    const isSuperAdmin = session.user.role === "super_admin"
    const vps = await db.userVpsService.findUnique({
      where: { id: data.serviceId },
      include: { tenant: true }
    })
    if (!vps) {
      return { success: false, error: "Layanan VPS tidak ditemukan." }
    }
    if (!isSuperAdmin && vps.userId !== session.user.id) {
      return { success: false, error: "Anda tidak memiliki hak atas layanan VPS ini." }
    }

    const tenantId = vps.tenantId

    await db.$transaction(async (tx) => {
      await tx.userVpsService.update({
        where: { id: vps.id },
        data: {
          tenantId: null,
          status: "ready"
        }
      })

      if (tenantId) {
        await tx.tenant.update({
          where: { id: tenantId },
          data: { databaseUrl: null }
        })
      }
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        vpsServiceId: vps.id,
        previousTenantId: tenantId,
        action: "VPS_DISCONNECTED_FROM_WORKSPACE"
      }
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")
    if (tenantId) {
      revalidatePath(`/dashboard/${tenantId}`)
    }

    return { success: true, message: "Koneksi VPS dengan workspace berhasil diputus. Database workspace kembali ke Shared Pool." }
  } catch (error: any) {
    console.error("[disconnectVpsFromWorkspaceAction Error]:", error)
    return { success: false, error: error.message || "Gagal memutuskan koneksi VPS." }
  }
}

/**
 * Alokasikan instance Contabo langsung ke Workspace ID pelanggan (Khusus Super Admin)
 */
export async function assignContaboToWorkspaceAction(data: {
  instanceId: number
  serverName: string
  serverIp: string
  tenantId: string
  productId?: string
  productName?: string
  cpuCores?: number
  ramMb?: number
  diskMb?: number
  databaseUrl?: string
}) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: "Sesi tidak valid, silakan login kembali." }
    }

    if (session.user.role !== "super_admin") {
      return { success: false, error: "Hanya Super Admin yang dapat mengalokasikan compute instance Contabo." }
    }

    const tenant = await db.tenant.findUnique({
      where: { id: data.tenantId }
    })
    if (!tenant) {
      return { success: false, error: "Workspace tujuan tidak ditemukan." }
    }

    // Default PostgreSQL URL jika tidak diinput
    const dbName = `${tenant.name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}_db`
    const dbUrl = data.databaseUrl || `postgresql://postgres:password@${data.serverIp}:5432/${dbName}?schema=public`

    const existing = await db.userVpsService.findFirst({
      where: { serverIp: data.serverIp }
    })

    let service: any
    const paidUntil = new Date()
    paidUntil.setFullYear(paidUntil.getFullYear() + 1)

    await db.$transaction(async (tx) => {
      // Lepaskan VPS sebelumnya dari tenant ini jika ada
      await tx.userVpsService.updateMany({
        where: { tenantId: tenant.id, ...(existing ? { id: { not: existing.id } } : {}) },
        data: { tenantId: null, status: "ready" }
      })

      if (existing) {
        service = await tx.userVpsService.update({
          where: { id: existing.id },
          data: {
            tenantId: tenant.id,
            serverName: data.serverName,
            status: "in_use",
            databaseUrl: dbUrl,
            specs: {
              contaboInstanceId: data.instanceId,
              cpuCores: data.cpuCores,
              ramMb: data.ramMb,
              diskMb: data.diskMb,
              productName: data.productName,
            }
          }
        })
      } else {
        service = await tx.userVpsService.create({
          data: {
            userId: session.user.id,
            tenantId: tenant.id,
            planSlug: (data.productId || "contabo-vps").toLowerCase(),
            planName: data.productName || `Contabo ${data.serverName}`,
            serverName: data.serverName,
            serverIp: data.serverIp,
            billingCycle: "yearly",
            pricePaid: 0,
            status: "in_use",
            databaseUrl: dbUrl,
            specs: {
              contaboInstanceId: data.instanceId,
              cpuCores: data.cpuCores,
              ramMb: data.ramMb,
              diskMb: data.diskMb,
              productName: data.productName,
            },
            notes: `Alokasi Contabo Instance ID: ${data.instanceId} untuk Workspace ${tenant.name}`,
            paidUntil,
          }
        })
      }

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { databaseUrl: dbUrl }
      })
    })

    logAudit({
      userId: session.user.id,
      action: AuditAction.SETTINGS_UPDATED,
      entity: "UserVpsService",
      data: {
        action: "CONTABO_ASSIGNED_TO_WORKSPACE",
        contaboInstanceId: data.instanceId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        serverIp: data.serverIp,
      }
    })

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/services")
    revalidatePath(`/dashboard/${tenant.slug || tenant.id}`)

    return {
      success: true,
      service,
      message: `Instance Contabo ${data.serverName} berhasil dialokasikan ke workspace ${tenant.name}.`
    }
  } catch (error: any) {
    console.error("[assignContaboToWorkspaceAction Error]:", error)
    return { success: false, error: error.message || "Gagal mengalokasikan instance Contabo ke workspace." }
  }
}

