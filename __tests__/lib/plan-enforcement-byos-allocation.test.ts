import { describe, it, expect, vi, beforeEach } from "vitest"
import { db } from "@/lib/database"
import { getOwnerFlatStorageAllocation, hasOwnerByos, DEFAULT_WORKSPACE_STORAGE_GB } from "@/lib/plan-enforcement"

vi.mock("@/lib/database", () => {
  const mockDb = {
    user: { findUnique: vi.fn() },
    enterpriseStorageAllocation: { findFirst: vi.fn() },
  }
  return { db: mockDb, getTenantDb: vi.fn() }
})

const GB = 1024 * 1024 * 1024

describe("getOwnerFlatStorageAllocation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("defaults a workspace with no explicit row to DEFAULT_WORKSPACE_STORAGE_GB", async () => {
    ;(db.enterpriseStorageAllocation.findFirst as any).mockResolvedValue(null)

    const slice = await getOwnerFlatStorageAllocation("owner1", "tenant-a")

    expect(slice).toEqual({ allocatedBytes: DEFAULT_WORKSPACE_STORAGE_GB * GB, isExplicit: false })
  })

  it("honors an explicit allocation row over the default, with no pool ceiling", async () => {
    ;(db.enterpriseStorageAllocation.findFirst as any).mockResolvedValue({ allocatedGb: 15 })

    const slice = await getOwnerFlatStorageAllocation("owner1", "tenant-a")

    expect(slice).toEqual({ allocatedBytes: 15 * GB, isExplicit: true })
  })

  it("only looks up the row for this exact owner+tenant pair", async () => {
    ;(db.enterpriseStorageAllocation.findFirst as any).mockResolvedValue(null)

    await getOwnerFlatStorageAllocation("owner1", "tenant-a")

    expect(db.enterpriseStorageAllocation.findFirst).toHaveBeenCalledWith({
      where: { ownerId: "owner1", tenantId: "tenant-a" },
      select: { allocatedGb: true },
    })
  })
})

describe("hasOwnerByos", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("is false when masterStorageConfig is unset", async () => {
    ;(db.user.findUnique as any).mockResolvedValue({ masterStorageConfig: null })
    expect(await hasOwnerByos("owner1")).toBe(false)
  })

  it("is false when masterStorageConfig is missing a required field", async () => {
    ;(db.user.findUnique as any).mockResolvedValue({
      masterStorageConfig: { endpoint: "https://minio.example.com", accessKey: "ak", bucket: "b" },
    })
    expect(await hasOwnerByos("owner1")).toBe(false)
  })

  it("is true when every MinIO field is present", async () => {
    ;(db.user.findUnique as any).mockResolvedValue({
      masterStorageConfig: { endpoint: "https://minio.example.com", accessKey: "ak", secretKey: "sk", bucket: "b" },
    })
    expect(await hasOwnerByos("owner1")).toBe(true)
  })
})
