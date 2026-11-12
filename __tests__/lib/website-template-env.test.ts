import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/database", () => ({
  db: {
    apiToken: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    setting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { db } from "@/lib/database"
import {
  findWebsiteTemplateEnvFile,
  parseWebsiteTemplateEnvVars,
  resolveWebsiteTemplateEnvVars,
  resolveApiOrigin,
} from "@/lib/infrastructure/frontend-env"

describe("findWebsiteTemplateEnvFile", () => {
  it("finds a .env.example at the root", () => {
    const files = [{ path: "package.json", content: "{}" }, { path: ".env.example", content: "X=1" }]
    expect(findWebsiteTemplateEnvFile(files)?.path).toBe(".env.example")
  })

  it("finds a nested .env.sample / .env.template / plain .env", () => {
    expect(findWebsiteTemplateEnvFile([{ path: "apps/web/.env.sample", content: "" }])?.path).toBe("apps/web/.env.sample")
    expect(findWebsiteTemplateEnvFile([{ path: ".env.template", content: "" }])?.path).toBe(".env.template")
    expect(findWebsiteTemplateEnvFile([{ path: ".env", content: "" }])?.path).toBe(".env")
  })

  it("returns null when no env file is present", () => {
    expect(findWebsiteTemplateEnvFile([{ path: "app/page.tsx", content: "" }])).toBeNull()
  })
})

describe("parseWebsiteTemplateEnvVars", () => {
  it("returns an empty array when the bundle has no env file", () => {
    expect(parseWebsiteTemplateEnvVars([{ path: "app/page.tsx", content: "" }])).toEqual([])
  })

  it("skips comments and blank lines", () => {
    const content = "# a comment\n\nNEXT_PUBLIC_SITE_NAME=Acme\n"
    const result = parseWebsiteTemplateEnvVars([{ path: ".env.example", content }])
    expect(result).toEqual([{ key: "NEXT_PUBLIC_SITE_NAME", literalValue: "Acme" }])
  })

  it("never emits a reserved SaCMS system key as a custom var", () => {
    const content = "NEXT_PUBLIC_SACMS_API_URL=whatever\nSACMS_API_KEY=whatever\nNEXT_PUBLIC_SITE_NAME=Acme\n"
    const result = parseWebsiteTemplateEnvVars([{ path: ".env.example", content }])
    expect(result).toEqual([{ key: "NEXT_PUBLIC_SITE_NAME", literalValue: "Acme" }])
  })

  it("strips surrounding quotes from a literal value", () => {
    const content = 'NEXT_PUBLIC_SITE_NAME="Acme Corp"\n'
    const result = parseWebsiteTemplateEnvVars([{ path: ".env.example", content }])
    expect(result).toEqual([{ key: "NEXT_PUBLIC_SITE_NAME", literalValue: "Acme Corp" }])
  })

  it("recognizes the {{SACMS_*}} placeholder convention", () => {
    const content = [
      "NEXT_PUBLIC_API_URL={{SACMS_API_URL}}",
      "NEXT_PUBLIC_TENANT={{ SACMS_TENANT_SLUG }}",
      "API_SECRET={{SACMS_API_KEY}}",
    ].join("\n")
    const result = parseWebsiteTemplateEnvVars([{ path: ".env.example", content }])
    expect(result).toEqual([
      { key: "NEXT_PUBLIC_API_URL", placeholder: "SACMS_API_URL", literalValue: "{{SACMS_API_URL}}" },
      { key: "NEXT_PUBLIC_TENANT", placeholder: "SACMS_TENANT_SLUG", literalValue: "{{ SACMS_TENANT_SLUG }}" },
      { key: "API_SECRET", placeholder: "SACMS_API_KEY", literalValue: "{{SACMS_API_KEY}}" },
    ])
  })

  it("ignores an invalid key name (not UPPER_SNAKE_CASE)", () => {
    const content = "lowercase_key=value\n"
    expect(parseWebsiteTemplateEnvVars([{ path: ".env.example", content }])).toEqual([])
  })
})

describe("resolveWebsiteTemplateEnvVars", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns [] when the bundle has no env file", async () => {
    const result = await resolveWebsiteTemplateEnvVars("tenant1", "acme", [{ path: "app/page.tsx", content: "" }])
    expect(result).toEqual([])
    expect(db.apiToken.findFirst).not.toHaveBeenCalled()
  })

  it("resolves SACMS_API_URL and SACMS_TENANT_SLUG placeholders WITHOUT touching the DB", async () => {
    const content = "NEXT_PUBLIC_API_URL={{SACMS_API_URL}}\nNEXT_PUBLIC_TENANT={{SACMS_TENANT_SLUG}}\n"
    const result = await resolveWebsiteTemplateEnvVars("tenant1", "acme", [{ path: ".env.example", content }])

    expect(result).toEqual([
      { key: "NEXT_PUBLIC_API_URL", value: resolveApiOrigin() },
      { key: "NEXT_PUBLIC_TENANT", value: "acme" },
    ])
    expect(db.apiToken.findFirst).not.toHaveBeenCalled()
  })

  it("resolves a SACMS_API_KEY placeholder to a real minted deploy token", async () => {
    vi.mocked(db.apiToken.findFirst).mockResolvedValue(null)
    vi.mocked(db.setting.findUnique).mockResolvedValue(null)
    vi.mocked(db.apiToken.create).mockResolvedValue({} as any)
    vi.mocked(db.setting.upsert).mockResolvedValue({} as any)

    const content = "API_SECRET={{SACMS_API_KEY}}\n"
    const result = await resolveWebsiteTemplateEnvVars("tenant1", "acme", [{ path: ".env.example", content }])

    expect(result).toHaveLength(1)
    expect(result[0].key).toBe("API_SECRET")
    expect(result[0].value).toMatch(/^sacms_live_[a-f0-9]+$/)
  })

  it("keeps a non-placeholder literal value as-is", async () => {
    const content = "NEXT_PUBLIC_SITE_NAME=Acme Corp\n"
    const result = await resolveWebsiteTemplateEnvVars("tenant1", "acme", [{ path: ".env.example", content }])
    expect(result).toEqual([{ key: "NEXT_PUBLIC_SITE_NAME", value: "Acme Corp" }])
  })
})
