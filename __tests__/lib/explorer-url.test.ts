import { describe, expect, it } from "vitest"
import { resolveExplorerUrl } from "@/lib/api/explorer-url"

const origin = "https://cms.example.test"

describe("API Explorer workspace URL", () => {
  it("accepts the workspace path and its absolute same-origin form", () => {
    const path = "/api/public/alpha/content/articles?limit=10"
    expect(resolveExplorerUrl(path, origin, "alpha")?.href).toBe(origin + path)
    expect(resolveExplorerUrl(origin + path, origin, "alpha")?.href).toBe(origin + path)
  })

  it("rules out other workspaces, control-plane APIs, and external origins", () => {
    for (const endpoint of [
      "/api/public/other/content/articles",
      "/api/tenant/alpha/settings",
      "https://other.example.test/api/public/alpha/content/articles",
      "//other.example.test/api/public/alpha/content/articles",
    ]) {
      expect(resolveExplorerUrl(endpoint, origin, "alpha")).toBeNull()
    }
  })
})
