import { describe, it, expect } from "vitest"
import { whiteLabelSchema } from "@/app/api/tenant/[tenant]/white-label/route"

// Regression test for a real bug found 2026-10-25: the white-label PATCH
// schema required brandLogo/faviconUrl to be a full absolute URL (z.url()),
// but POST /api/tenant/[tenant]/media — which the settings page's "Unggah
// Gambar Logo"/"Unggah Favicon" buttons call directly — legitimately
// returns a server-relative URL like "/api/media/serve?key=..." whenever
// the workspace's storage has no publicUrl configured (buildUrl() in
// src/lib/r2.ts), or the local-disk dev fallback ("/${storageKey}"). That
// made "Simpan Branding" fail right after using the upload button — the
// one workflow the UI itself promotes ("unggah langsung").

describe("white-label branding schema — relative media URLs", () => {
  it("accepts a relative /api/media/serve URL for brandLogo (the common upload-button result)", () => {
    const result = whiteLabelSchema.safeParse({ brandLogo: "/api/media/serve?key=tenant-media/abc.png" })
    expect(result.success).toBe(true)
  })

  it("accepts a relative local-disk URL for faviconUrl", () => {
    const result = whiteLabelSchema.safeParse({ faviconUrl: "/tenant-media/delvia/favicon.ico" })
    expect(result.success).toBe(true)
  })

  it("still accepts a real absolute URL", () => {
    const result = whiteLabelSchema.safeParse({ brandLogo: "https://acme.com/logo.png" })
    expect(result.success).toBe(true)
  })

  it("still accepts an empty string (clearing the field)", () => {
    const result = whiteLabelSchema.safeParse({ brandLogo: "", faviconUrl: "" })
    expect(result.success).toBe(true)
  })

  it("rejects garbage that's neither an absolute URL nor a path", () => {
    const result = whiteLabelSchema.safeParse({ brandLogo: "not a url at all" })
    expect(result.success).toBe(false)
  })
})
