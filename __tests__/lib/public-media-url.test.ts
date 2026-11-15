import { describe, it, expect } from "vitest"
import { rewritePublicMediaUrls } from "@/lib/public-media-url"
import { resolveApiOrigin } from "@/lib/infrastructure/frontend-env"

// A real finding: a published product's photo came back empty on the
// public-facing site because the public content API returned the CMS
// dashboard's own private, session-gated media URL verbatim
// (/api/media/serve?key=...), which 401s with no login. This rewrites any
// such embedded URL to the new unauthenticated /api/public/media route,
// recursively through whatever shape a media field (or a component/
// repeater holding one) happens to take.

describe("rewritePublicMediaUrls", () => {
  it("rewrites a private media proxy URL to the public equivalent, preserving the key", () => {
    const result = rewritePublicMediaUrls("/api/media/serve?key=t1/jpg/photo_123.jpg")
    expect(result).toBe(`${resolveApiOrigin()}/api/public/media?key=t1/jpg/photo_123.jpg`)
  })

  it("leaves an already-public or unrelated string untouched", () => {
    expect(rewritePublicMediaUrls("https://cdn.example.com/photo.jpg")).toBe("https://cdn.example.com/photo.jpg")
    expect(rewritePublicMediaUrls("hello world")).toBe("hello world")
  })

  it("rewrites every matching string nested inside an object (a media field's own shape)", () => {
    const media = {
      url: "/api/media/serve?key=t1/jpg/photo_123.jpg",
      thumbnailUrl: "/api/media/serve?key=t1/jpg/photo_123_thumb.jpg",
      mediumUrl: "/api/media/serve?key=t1/jpg/photo_123_medium.jpg",
      name: "photo.jpg",
      size: 12345,
    }
    const result = rewritePublicMediaUrls(media)
    expect(result.url).toBe(`${resolveApiOrigin()}/api/public/media?key=t1/jpg/photo_123.jpg`)
    expect(result.thumbnailUrl).toBe(`${resolveApiOrigin()}/api/public/media?key=t1/jpg/photo_123_thumb.jpg`)
    expect(result.mediumUrl).toBe(`${resolveApiOrigin()}/api/public/media?key=t1/jpg/photo_123_medium.jpg`)
    expect(result.name).toBe("photo.jpg")
    expect(result.size).toBe(12345)
  })

  it("recurses into arrays and nested component/repeater objects", () => {
    const data = {
      title: "Capucion Late Ice",
      gallery: [
        { url: "/api/media/serve?key=t1/jpg/a.jpg" },
        { url: "/api/media/serve?key=t1/jpg/b.jpg" },
      ],
      hero: { photo: { url: "/api/media/serve?key=t1/jpg/hero.jpg" } },
    }
    const result = rewritePublicMediaUrls(data) as any
    expect(result.gallery[0].url).toContain("/api/public/media?key=t1/jpg/a.jpg")
    expect(result.gallery[1].url).toContain("/api/public/media?key=t1/jpg/b.jpg")
    expect(result.hero.photo.url).toContain("/api/public/media?key=t1/jpg/hero.jpg")
    expect(result.title).toBe("Capucion Late Ice")
  })

  it("passes through null/undefined/number/boolean values unchanged", () => {
    expect(rewritePublicMediaUrls(null)).toBeNull()
    expect(rewritePublicMediaUrls(undefined)).toBeUndefined()
    expect(rewritePublicMediaUrls(42)).toBe(42)
    expect(rewritePublicMediaUrls(true)).toBe(true)
  })
})
