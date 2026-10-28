import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockQueryRaw, mockDisconnect, mockS3Send } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockDisconnect: vi.fn(),
  mockS3Send: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))

vi.mock("@/lib/database", () => ({
  PrismaClient: class MockPrismaClient {
    $queryRaw = mockQueryRaw
    $disconnect = mockDisconnect
  },
  isOwnerEligibleForByoInfra: vi.fn(),
}))

vi.mock("@/lib/s3-client", () => ({
  createS3Client: vi.fn(() => ({ send: mockS3Send })),
}))

import { getServerSession } from "next-auth"
import { isOwnerEligibleForByoInfra } from "@/lib/database"
import { POST } from "@/app/api/user/infrastructure/test-connection/route"

const mockSession = vi.mocked(getServerSession)
const jsonReq = (body: unknown) =>
  new Request("https://api.test/x", { method: "POST", body: JSON.stringify(body) }) as any

describe("POST /api/user/infrastructure/test", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({ user: { id: "owner1" } } as any)
    mockDisconnect.mockResolvedValue(undefined)
  })

  it("rejects a non-eligible owner before attempting any connection", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(false)

    const res = await POST(jsonReq({ type: "database", url: "postgresql://x:y@host:5432/db" }))

    expect(res.status).toBe(403)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it("rejects a database URL that isn't postgres://", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)

    const res = await POST(jsonReq({ type: "database", url: "mysql://x:y@host:3306/db" }))

    expect(res.status).toBe(400)
    expect(mockQueryRaw).not.toHaveBeenCalled()
  })

  it("reports success for a reachable database and always disconnects", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    mockQueryRaw.mockResolvedValue([{ "?column?": 1 }])

    const res = await POST(jsonReq({ type: "database", url: "postgresql://x:y@host:5432/db" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it("reports failure (not a thrown error) when the database is unreachable, and still disconnects", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    mockQueryRaw.mockRejectedValue(new Error("connect ECONNREFUSED"))

    const res = await POST(jsonReq({ type: "database", url: "postgresql://x:y@host:5432/db" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.message).toContain("ECONNREFUSED")
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it("reports success for a reachable MinIO bucket", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    mockS3Send.mockResolvedValue({})

    const res = await POST(
      jsonReq({ type: "storage", config: { endpoint: "https://minio.example.com", accessKey: "ak", secretKey: "sk", bucket: "b" } })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
  })

  it("reports failure when the MinIO bucket/credentials are wrong", async () => {
    vi.mocked(isOwnerEligibleForByoInfra).mockResolvedValue(true)
    mockS3Send.mockRejectedValue(new Error("NoSuchBucket"))

    const res = await POST(
      jsonReq({ type: "storage", config: { endpoint: "https://minio.example.com", accessKey: "ak", secretKey: "sk", bucket: "b" } })
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(false)
    expect(body.message).toContain("NoSuchBucket")
  })
})
