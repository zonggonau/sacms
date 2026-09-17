import { describe, it, expect, afterEach } from "vitest"
import { generateTenantMediaKey, getPlatformStorage, isPlatformStorageKey } from "@/lib/r2"
import { planMediaMove } from "../../scripts/migrate-local-media"

describe("platform object storage", () => {
  const saved = { ...process.env }
  afterEach(() => {
    process.env = { ...saved }
  })

  it("is off without S3_ENDPOINT", () => {
    delete process.env.S3_ENDPOINT
    expect(getPlatformStorage()).toBeNull()
  })

  it("uses the sacms-media bucket by default", () => {
    process.env.S3_ENDPOINT = "http://minio:9000"
    process.env.S3_ACCESS_KEY_ID = "k"
    process.env.S3_SECRET_ACCESS_KEY = "s"
    delete process.env.S3_BUCKET
    expect(getPlatformStorage()?.bucket).toBe("sacms-media")
  })

  it("puts workspace media in a folder named by the workspace id", () => {
    const key = generateTenantMediaKey("cmabc123", "Foto Kantor.JPG")
    expect(key).toMatch(/^cmabc123\/jpg\/foto_kantor_\d+\.jpg$/)
    expect(isPlatformStorageKey(key)).toBe(true)
    expect(isPlatformStorageKey("upload/acme/jpg/a.jpg")).toBe(false)
  })
})

describe("local media migration plan", () => {
  const row = {
    id: "m1",
    tenantId: "cmabc123",
    url: "/upload/acme/jpg/foto_1.jpg",
    thumbnailUrl: "/upload/acme/jpg/foto_1_thumb.jpg",
    mediumUrl: null,
    storageKey: "upload/acme/jpg/foto_1.jpg",
  }

  it("moves the file and its thumbnail into the workspace folder", () => {
    const present = new Set(["upload/acme/jpg/foto_1.jpg", "upload/acme/jpg/foto_1_thumb.jpg"])
    const move = planMediaMove(row, "acme", "https://media.sacms.cloud/sacms-media", (k) => present.has(k))

    expect(move?.objects).toEqual([
      { from: "upload/acme/jpg/foto_1.jpg", to: "cmabc123/jpg/foto_1.jpg" },
      { from: "upload/acme/jpg/foto_1_thumb.jpg", to: "cmabc123/jpg/foto_1_thumb.jpg" },
    ])
    expect(move?.update).toEqual({
      storageKey: "cmabc123/jpg/foto_1.jpg",
      url: "https://media.sacms.cloud/sacms-media/cmabc123/jpg/foto_1.jpg",
      thumbnailUrl: "https://media.sacms.cloud/sacms-media/cmabc123/jpg/foto_1_thumb.jpg",
      mediumUrl: null,
    })
  })

  it("skips rows already moved or whose file is missing", () => {
    expect(planMediaMove({ ...row, storageKey: "cmabc123/jpg/foto_1.jpg", url: "https://x/y" }, "acme", "", () => true)).toBeNull()
    expect(planMediaMove(row, "acme", "", () => false)).toBeNull()
  })
})
