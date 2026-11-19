import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }))
vi.mock("@/lib/auth", () => ({ authOptions: {} }))
vi.mock("@/lib/tenant-access", () => ({ getTenantAccess: vi.fn() }))
vi.mock("@/lib/ai", () => ({ safeGenerateContent: vi.fn() }))

import { getServerSession } from "next-auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { safeGenerateContent } from "@/lib/ai"
import { POST } from "@/app/api/tenant/[tenant]/ai/translate/route"

function translate() {
  return POST(new Request("https://example.test/api/tenant/acme/ai/translate", {
    method: "POST",
    body: JSON.stringify({ sourceLocale: "id", targetLocale: "en", data: { title: "Beranda" } }),
  }) as Parameters<typeof POST>[0], { params: Promise.resolve({ tenant: "acme" }) })
}

describe("CMS AI translation", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "editor", role: "editor" } } as never)
    vi.mocked(getTenantAccess).mockResolvedValue({ tenantId: "tenant-1", role: "editor" } as never)
  })

  it("returns an error on provider failure instead of applying simulated translations", async () => {
    vi.mocked(safeGenerateContent).mockRejectedValue(new Error("Gateway unavailable"))

    const response = await translate()
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ code: "internal", error: "Layanan terjemahan AI gagal. Coba lagi." })
  })

  it("never passes unrequested fields from the model back to the editor", async () => {
    vi.mocked(safeGenerateContent).mockResolvedValue({ text: '{"title":"Home","slug":"wrong-slug"}' } as never)

    const response = await translate()
    expect(response.status).toBe(200)
    expect((await response.json()).translatedData).toEqual({ title: "Home" })
  })

  it("rejects AI output that omits a requested field", async () => {
    vi.mocked(safeGenerateContent).mockResolvedValue({ text: '{"slug":"home"}' } as never)

    const response = await translate()
    expect(response.status).toBe(502)
  })
})
