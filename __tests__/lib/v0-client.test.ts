import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  resolveV0ApiKey,
  checkV0Configured,
  getV0Client,
  generateFallbackFiles,
  createV0Chat,
  iterateV0ChatReal,
  normalizeV0Model,
  V0_MODELS,
} from "@/lib/v0-client"

vi.mock("@/lib/settings", () => ({
  getResolvedAiConfig: vi.fn().mockResolvedValue({
    v0ApiKey: "",
    vercelAccessToken: "",
    defaultModel: "google/gemini-2.5-flash",
  }),
}))

describe("v0 SDK Integration & Frontend Generator", () => {
  const originalEnvKey = process.env.V0_API_KEY
  const originalVercelToken = process.env.VERCEL_ACCESS_TOKEN

  beforeEach(() => {
    delete process.env.V0_API_KEY
    delete process.env.VERCEL_ACCESS_TOKEN
  })

  afterEach(() => {
    if (originalEnvKey !== undefined) {
      process.env.V0_API_KEY = originalEnvKey
    } else {
      delete process.env.V0_API_KEY
    }
    if (originalVercelToken !== undefined) {
      process.env.VERCEL_ACCESS_TOKEN = originalVercelToken
    } else {
      delete process.env.VERCEL_ACCESS_TOKEN
    }
  })

  it("should resolve explicit key when provided", async () => {
    const key = await resolveV0ApiKey("test_explicit_key_12345")
    expect(key).toBe("test_explicit_key_12345")
  })

  it("should resolve process.env.V0_API_KEY when present", async () => {
    process.env.V0_API_KEY = "env_v0_secret_key_99999"
    const key = await resolveV0ApiKey()
    expect(key).toBe("env_v0_secret_key_99999")
  })

  it("should check configured status and mask the key correctly", async () => {
    process.env.V0_API_KEY = "v0_secret_live_token_7777"
    const status = await checkV0Configured()
    expect(status.configured).toBe(true)
    expect(status.source).toBe("env")
    expect(status.maskedKey).toContain("...")
    expect(status.maskedKey.startsWith("v0_s")).toBe(true)
  })

  it("should report unconfigured when no key is set", async () => {
    const status = await checkV0Configured()
    expect(status.configured).toBe(false)
    expect(status.source).toBe("none")
    expect(status.maskedKey).toBe("")
  })

  it("should instantiate a client with Bearer auth when key is provided", () => {
    const client = getV0Client("custom_api_key_8888")
    expect(client).toBeDefined()
    expect(client.chats).toBeDefined()
    expect(typeof client.chats.createAsync).toBe("function")
    expect(typeof client.chats.getFiles).toBe("function")
  })

  it("should generate rich fallback files for hotel prompt", () => {
    const files = generateFallbackFiles("buat website resort hotel mewah di pesisir pantai")
    expect(files.length).toBeGreaterThan(0)
    expect(files[0].name).toBe("app/page.tsx")
    expect(files[0].content).toContain("Grand Luxury Resort & Hotel")
    expect(files[0].content).toContain("use client")
    expect(files[0].content).toContain("lucide-react")
  })

  it("should generate rich fallback files for ecommerce store prompt", () => {
    const files = generateFallbackFiles("buat toko online noken dan kerajinan")
    expect(files.length).toBeGreaterThan(0)
    expect(files[0].name).toBe("app/page.tsx")
    expect(files[0].content).toContain("Toko Online Modern")
  })

  it("should return fallback project safely when v0 key is absent in non-production", async () => {
    const res = await createV0Chat("portal berita pemda", "v0-pro", { waitForFiles: false })
    expect(res).toBeDefined()
    expect(res.chatId).toBeDefined()
    expect(res.files.length).toBeGreaterThan(0)
    expect(res.files[0].name).toBe("app/page.tsx")
  })

  it("should normalize v0 model ids and default to v0-pro", () => {
    expect(normalizeV0Model("v0-max")).toBe("v0-max")
    expect(normalizeV0Model("v0-mini")).toBe("v0-mini")
    expect(normalizeV0Model("gpt-4")).toBe("v0-pro")
    expect(normalizeV0Model(undefined)).toBe("v0-pro")
    expect(V0_MODELS.map((m) => m.id)).toEqual(["v0-mini", "v0-pro", "v0-max", "v0-max-fast"])
  })

  it("should report an error (never a fallback template) when iterating without a v0 key", async () => {
    const res = await iterateV0ChatReal("chat_real_1", "ubah navbar", { maxWaitSeconds: 1 })
    expect(res.changed).toBe(false)
    expect(res.files).toEqual([])
    expect(res.v0Error).toBeTruthy()
  })
})
