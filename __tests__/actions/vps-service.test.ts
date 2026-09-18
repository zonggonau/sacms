import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: {
    SETTINGS_UPDATED: "SETTINGS_UPDATED",
    TENANT_CREATED: "TENANT_CREATED",
  },
}))

import { getServerSession } from "next-auth"
import { db } from "@/lib/database"
import { orderVpsAction, setupVpsAction, getUserVpsServicesAction } from "@/actions/vps-service"

const mockDb = db as any

describe("VPS Service Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should fail order if user is not authenticated", async () => {
    ;(getServerSession as any).mockResolvedValue(null)

    const res = await orderVpsAction({
      planSlug: "vps-plus-4",
      planName: "Cloud VPS Plus 4 (8GB)",
      serverName: "Server Test",
      billingCycle: "monthly",
      pricePaid: 700000,
    })

    expect(res.success).toBe(false)
    expect(res.error).toContain("Sesi tidak valid")
  })

  it("should create awaiting_setup VPS order and IT support ticket when authenticated", async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: "user_test_123", name: "John Doe", email: "john@example.com", role: "owner" },
    })

    mockDb.supportTicket = {
      create: vi.fn().mockResolvedValue({ id: "ticket_123" }),
    }

    mockDb.userVpsService = {
      create: vi.fn().mockResolvedValue({
        id: "vps_svc_123",
        userId: "user_test_123",
        planSlug: "vps-plus-4",
        planName: "Cloud VPS Plus 4 (8GB)",
        serverName: "Server Produksi #1",
        billingCycle: "monthly",
        pricePaid: 700000,
        status: "awaiting_setup",
        ticketId: "ticket_123",
      }),
    }

    mockDb.paymentTransaction = {
      create: vi.fn().mockResolvedValue({ id: "tx_123" }),
    }

    const res = await orderVpsAction({
      planSlug: "vps-plus-4",
      planName: "Cloud VPS Plus 4 (8GB)",
      serverName: "Server Produksi #1",
      billingCycle: "monthly",
      pricePaid: 700000,
      notes: "Mohon pasang PostgreSQL 17 dengan PostGIS",
    })

    expect(res.success).toBe(true)
    expect(res.serviceId).toBe("vps_svc_123")
    expect(res.ticketId).toBe("ticket_123")

    expect(mockDb.supportTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_test_123",
          category: "infrastructure",
          priority: "high",
          status: "open",
        }),
      })
    )

    expect(mockDb.userVpsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_test_123",
          planSlug: "vps-plus-4",
          serverName: "Server Produksi #1",
          status: "awaiting_setup",
        }),
      })
    )
  })

  it("should allow IT Support to setup IP and database URL, changing status to ready", async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: "admin_123", role: "super_admin" },
    })

    mockDb.userVpsService = {
      findUnique: vi.fn().mockResolvedValue({
        id: "vps_svc_123",
        userId: "user_test_123",
        serverName: "Server Produksi #1",
        ticketId: "ticket_123",
        status: "awaiting_setup",
      }),
      update: vi.fn().mockResolvedValue({
        id: "vps_svc_123",
        status: "ready",
        serverIp: "161.97.100.52",
        databaseUrl: "postgresql://usr:pass@161.97.100.52:5432/vps_db",
      }),
    }

    mockDb.supportMessage = {
      create: vi.fn().mockResolvedValue({ id: "msg_123" }),
    }
    mockDb.supportTicket = {
      update: vi.fn().mockResolvedValue({ id: "ticket_123", status: "resolved" }),
    }

    const res = await setupVpsAction({
      serviceId: "vps_svc_123",
      serverIp: "161.97.100.52",
      databaseUrl: "postgresql://usr:pass@161.97.100.52:5432/vps_db",
      adminNotes: "Instalasi selesai",
    })

    expect(res.success).toBe(true)
    expect(mockDb.userVpsService.update).toHaveBeenCalledWith({
      where: { id: "vps_svc_123" },
      data: expect.objectContaining({
        status: "ready",
        serverIp: "161.97.100.52",
        databaseUrl: "postgresql://usr:pass@161.97.100.52:5432/vps_db",
      }),
    })

    expect(mockDb.supportTicket.update).toHaveBeenCalledWith({
      where: { id: "ticket_123" },
      data: { status: "resolved" },
    })
  })

  it("should import Contabo instance into userVpsService and set status to ready", async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: "user_test_123" },
    })

    mockDb.userVpsService.findFirst = vi.fn().mockResolvedValue(null)
    mockDb.userVpsService.create = vi.fn().mockResolvedValue({
      id: "imported_vps_1",
      userId: "user_test_123",
      serverName: "SACMS",
      serverIp: "164.68.116.79",
      status: "ready",
    })

    const { importContaboInstanceAction } = await import("@/actions/vps-service")
    const res = await importContaboInstanceAction({
      instanceId: 203288954,
      serverName: "SACMS",
      serverIp: "164.68.116.79",
      productId: "V95",
      productName: "Cloud VPS 20 SSD",
      cpuCores: 6,
      ramMb: 12288,
      diskMb: 204800,
    })

    expect(res.success).toBe(true)
    expect(res.service?.serverIp).toBe("164.68.116.79")
    expect(mockDb.userVpsService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_test_123",
          serverName: "SACMS",
          serverIp: "164.68.116.79",
          status: "ready",
        }),
      })
    )
  })

  it("should block non-super_admin from fetching live Contabo instances", async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: "customer_1", role: "owner" },
    })

    const { fetchContaboInstancesAction } = await import("@/actions/vps-service")
    const res = await fetchContaboInstancesAction()

    expect(res.success).toBe(false)
    expect(res.error).toContain("Akses ditolak")
    expect(res.instances).toEqual([])
  })

  it("should assign a ready VPS to a customer workspace ID and update databaseUrl", async () => {
    ;(getServerSession as any).mockResolvedValue({
      user: { id: "user_test_123", role: "owner" },
    })

    mockDb.userVpsService = {
      findUnique: vi.fn().mockResolvedValue({
        id: "vps_ready_1",
        userId: "user_test_123",
        serverName: "INTANJAYAKAB",
        serverIp: "13.140.151.186",
        databaseUrl: "postgresql://postgres:pass@13.140.151.186:5432/intan_db?schema=public",
        status: "ready",
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      update: vi.fn().mockResolvedValue({
        id: "vps_ready_1",
        tenantId: "tenant_intan_123",
        status: "in_use",
      }),
    }

    mockDb.tenant = {
      findUnique: vi.fn().mockResolvedValue({
        id: "tenant_intan_123",
        name: "intanjayakab",
        ownerId: "user_test_123",
        members: [{ userId: "user_test_123", role: "owner" }],
      }),
      update: vi.fn().mockResolvedValue({
        id: "tenant_intan_123",
        databaseUrl: "postgresql://postgres:pass@13.140.151.186:5432/intan_db?schema=public",
      }),
    }

    mockDb.$transaction = vi.fn().mockImplementation(async (callback: any) => {
      return callback(mockDb)
    })

    const { assignVpsToWorkspaceAction } = await import("@/actions/vps-service")
    const res = await assignVpsToWorkspaceAction({
      serviceId: "vps_ready_1",
      tenantId: "tenant_intan_123",
    })

    expect(res.success).toBe(true)
    expect(mockDb.userVpsService.update).toHaveBeenCalledWith({
      where: { id: "vps_ready_1" },
      data: {
        tenantId: "tenant_intan_123",
        status: "in_use",
      },
    })
    expect(mockDb.tenant.update).toHaveBeenCalledWith({
      where: { id: "tenant_intan_123" },
      data: {
        databaseUrl: "postgresql://postgres:pass@13.140.151.186:5432/intan_db?schema=public",
      },
    })
  })
})


