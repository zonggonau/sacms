import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { POST } from "@/app/api/tenant/[tenant]/media/route"

const { create, findFirst, upload, removeObject } = vi.hoisted(() => ({
  create: vi.fn(),
  findFirst: vi.fn(),
  upload: vi.fn(),
  removeObject: vi.fn(),
}))

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/database", () => ({
  db: { tenant: { findUnique: vi.fn(async () => ({ id: "tenant1", slug: "coffee" })) } },
  getTenantDb: vi.fn(async () => ({ media: { create, findFirst } })),
}))
vi.mock("@/lib/r2", () => ({ uploadTenantMedia: upload, deleteFromStorage: removeObject }))
vi.mock("@/lib/plan-enforcement", () => ({ checkStorageUpload: vi.fn(async () => ({ allowed: true })) }))
vi.mock("@/lib/webhooks", () => ({
  WebhookEvents: { MEDIA_UPLOADED: "media.uploaded" },
  triggerWebhooks: vi.fn(async () => undefined),
}))
vi.mock("@/lib/audit-log", () => ({ AuditAction: { MEDIA_UPLOADED: "media_uploaded" }, logAudit: vi.fn() }))

const context = { params: Promise.resolve({ tenant: "coffee" }) }
const validPdf = new Blob(["%PDF-1.7\n"], { type: "application/pdf" })
const invalidPdf = new Blob(["broken"], { type: "application/pdf" })
const stored = (name: string) => ({
  url: `https://example.test/${name}`,
  storageKey: `tenant1/${name}`,
  thumbnailUrl: null,
  mediumUrl: null,
  width: null,
  height: null,
  variantBytes: 0,
})

function request(files: Array<[name: string, blob: Blob]>) {
  const formData = new FormData()
  for (const [name, file] of files) formData.append("files", file, name)
  return new NextRequest("https://example.test/api/tenant/coffee/media", { method: "POST", body: formData })
}

describe("CMS media batch upload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "staff1" }, expires: "2030-01-01" })
    vi.mocked(getTenantAccess).mockResolvedValue({ role: "owner", tenantId: "tenant1" } as NonNullable<Awaited<ReturnType<typeof getTenantAccess>>>)
    create.mockImplementation(async ({ data }) => ({ id: data.originalName, ...data }))
    upload.mockImplementation(async (_tenant, _buffer, name) => stored(name))
  })

  it("rejects an invalid later file before any file is stored", async () => {
    const response = await POST(request([["first.pdf", validPdf], ["broken.pdf", invalidPdf]]), context)

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("broken.pdf") })
    expect(upload).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("reports persisted files and individual failures after a storage error", async () => {
    upload.mockResolvedValueOnce(stored("first.pdf")).mockRejectedValueOnce(new Error("storage offline"))
    const response = await POST(request([["first.pdf", validPdf], ["retry.pdf", validPdf], ["last.pdf", validPdf]]), context)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      media: [{ id: "first.pdf" }, { id: "last.pdf" }],
      file: { id: "first.pdf" },
      failures: [{ name: "retry.pdf", error: "Failed to upload file to storage" }],
    })
  })

  it("cleans up an uploaded object once the database confirms no record exists", async () => {
    create.mockRejectedValueOnce(new Error("failed to record material"))
    findFirst.mockResolvedValueOnce(null)
    const response = await POST(request([["retry.pdf", validPdf]]), context)

    expect(response.status).toBe(503)
    expect(removeObject).toHaveBeenCalledWith("tenant1/retry.pdf", "tenant1")
  })
})
