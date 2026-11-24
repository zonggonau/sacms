import { expect, it, vi } from "vitest"
import { compareSchema, schemaRequirements } from "@/lib/infrastructure/site-schema-contract"
import { previewRoutePaths } from "@/lib/infrastructure/preview-route-paths"

vi.mock("@/lib/database", () => ({ getTenantDb: vi.fn() }))

it("checks saved frontend requirements against active fields and distinguishes legacy snapshots", () => {
  const saved = schemaRequirements({ singleTypes: [{ slug: "profile", fields: [{ slug: "name", type: "text", required: true }] }] })
  const active = [{ kind: "singleTypes" as const, slug: "profile", fields: [{ slug: "name", type: "text", required: true, relationSlug: null }] }]
  expect(compareSchema(saved, active).status).toBe("matches_snapshot")
  expect(compareSchema(saved, [{ ...active[0], fields: [] }])).toMatchObject({ status: "schema_changed", issues: [expect.stringContaining("profile/name")] })
  expect(compareSchema(null, active).status).toBe("unknown")
})

it("accepts route lists and rejects external hosts and protocol-relative paths", () => {
  expect(previewRoutePaths.safeParse(["/", "/karya", "/karya/detail?lang=id"]).success).toBe(true)
  for (const path of ["https://example.com", "//example.com", "/\\example.com", "relative"]) {
    expect(previewRoutePaths.safeParse([path]).success).toBe(false)
  }
})
