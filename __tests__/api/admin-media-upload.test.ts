import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { uploadGlobalMedia } from "@/lib/r2"
import { POST } from "@/app/api/admin/media/upload/route"

// Regression coverage for the fix: MediaLibraryDialog's global/admin branch
// (used by every "image" field on /admin/cms with no tenantSlug) used to
// point at /api/admin/media/upload, which never existed at all — a plain
// 404 that surfaced as a confusing "Unexpected token '<'" JSON-parse error
// in the browser. This route now exists and uploads straight to platform
// storage with no Media DB row (Media.tenantId has no tenantId:null
// support and there's no tenant left to anchor one to).

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/r2", () => ({ uploadGlobalMedia: vi.fn() }))
vi.mock("@/lib/audit-log", () => ({ AuditAction: { MEDIA_UPLOADED: "media_uploaded" }, logAudit: vi.fn() }))

const validPng = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/png" })

function request(file: Blob, filename = "cover.png") {
  const formData = new FormData()
  formData.append("files", file, filename)
  return new NextRequest("https://example.test/api/admin/media/upload", { method: "POST", body: formData })
}

describe("POST /api/admin/media/upload", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("rejects when the caller isn't super_admin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "u1", role: "admin" }, expires: "2030-01-01" } as any)

    const response = await POST(request(validPng), {} as any)

    expect(response.status).toBe(403)
    expect(uploadGlobalMedia).not.toHaveBeenCalled()
  })

  it("rejects when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const response = await POST(request(validPng), {} as any)

    expect(response.status).toBe(401)
  })

  it("uploads via uploadGlobalMedia and returns a plain URL (no Media row)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "super1", role: "super_admin" }, expires: "2030-01-01" } as any)
    vi.mocked(uploadGlobalMedia).mockResolvedValue({
      url: "https://example.test/global/cover.png",
      storageKey: "global/cover.png",
      thumbnailUrl: null,
      mediumUrl: null,
      width: null,
      height: null,
      variantBytes: 0,
    } as any)

    const response = await POST(request(validPng), {} as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(uploadGlobalMedia).toHaveBeenCalledWith(expect.any(Buffer), "cover.png", "image/png")
    expect(body).toEqual({
      url: "https://example.test/global/cover.png",
      name: "cover",
      originalName: "cover.png",
      mimeType: "image/png",
      size: validPng.size,
    })
  })

  it("rejects a file whose content doesn't match its claimed image type", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "super1", role: "super_admin" }, expires: "2030-01-01" } as any)
    const fakePng = new Blob(["not actually a png"], { type: "image/png" })

    const response = await POST(request(fakePng), {} as any)

    expect(response.status).toBe(400)
    expect(uploadGlobalMedia).not.toHaveBeenCalled()
  })

  it("rejects when no file is provided", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "super1", role: "super_admin" }, expires: "2030-01-01" } as any)
    const formData = new FormData()
    const req = new NextRequest("https://example.test/api/admin/media/upload", { method: "POST", body: formData })

    const response = await POST(req, {} as any)

    expect(response.status).toBe(400)
  })
})
