import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/database", () => ({
  isWorkspaceEligibleForByoInfra: vi.fn(),
}))
vi.mock("@/lib/byo-infra-test", () => ({
  testDatabaseConnection: vi.fn(),
  testStorageConnection: vi.fn(),
}))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { isWorkspaceEligibleForByoInfra } from "@/lib/database"
import { testDatabaseConnection, testStorageConnection } from "@/lib/byo-infra-test"
import { POST } from "@/app/api/tenant/[tenant]/infrastructure/test-connection/route"

const mockSession = vi.mocked(getServerSession)
const mockAccess = vi.mocked(getTenantAccess)
const ctx = (tenant: string) => ({ params: Promise.resolve({ tenant }) })
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "POST", body: JSON.stringify(body) }) as any

describe("POST /api/tenant/[tenant]/infrastructure/test-connection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "owner1" } } as any)
    mockAccess.mockResolvedValue({ role: "owner", tenantId: "tenant1", userId: "owner1" } as any)
  })

  it("rejects an ineligible workspace before calling testDatabaseConnection", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(false)

    const res = await POST(jsonReq({ type: "database", url: "postgresql://host/db" }), ctx("tenant1"))

    expect(res.status).toBe(403)
    expect(testDatabaseConnection).not.toHaveBeenCalled()
  })

  it("rejects a non-owner (minRole enforcement happens before the handler runs)", async () => {
    mockAccess.mockResolvedValue({ role: "editor", tenantId: "tenant1", userId: "editor1" } as any)

    const res = await POST(jsonReq({ type: "database", url: "postgresql://host/db" }), ctx("tenant1"))

    expect(res.status).toBe(403)
    expect(testDatabaseConnection).not.toHaveBeenCalled()
  })

  it("calls testDatabaseConnection for a valid URL when eligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(testDatabaseConnection).mockResolvedValue({ success: true, message: "Koneksi database berhasil." })

    const res = await POST(jsonReq({ type: "database", url: "postgresql://host:5432/db" }), ctx("tenant1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true, message: "Koneksi database berhasil." })
    expect(testDatabaseConnection).toHaveBeenCalledWith("postgresql://host:5432/db")
  })

  it("rejects an invalid URL format before calling testDatabaseConnection", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)

    const res = await POST(jsonReq({ type: "database", url: "mysql://host/db" }), ctx("tenant1"))

    expect(res.status).toBe(400)
    expect(testDatabaseConnection).not.toHaveBeenCalled()
  })

  it("calls testStorageConnection for a storage config when eligible", async () => {
    vi.mocked(isWorkspaceEligibleForByoInfra).mockResolvedValue(true)
    vi.mocked(testStorageConnection).mockResolvedValue({ success: true, message: "Koneksi storage berhasil, bucket ditemukan." })

    const config = { endpoint: "https://minio.example.com", accessKey: "ak", secretKey: "sk", bucket: "bucket1" }
    const res = await POST(jsonReq({ type: "storage", config }), ctx("tenant1"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(testStorageConnection).toHaveBeenCalledWith(config)
  })
})
