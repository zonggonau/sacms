import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { resolveWithinBase, SsrfError } from "@/lib/safe-url"
import { readFromStorage } from "@/lib/r2"
import path from "path"

/**
 * GET /api/public/media?key=...
 *
 * Unauthenticated byte-serving for media embedded in PUBLISHED content. A
 * real visitor's browser has no SaCMS session to present, so /api/media/serve
 * (session + tenant-membership gated, by design, for the CMS dashboard's own
 * media library) 401s for every public-facing page that renders an image —
 * confirmed live: a published menu item's photo came back empty because the
 * public content API embedded that private URL verbatim.
 *
 * This route is the rewrite target for any such URL (see
 * rewritePublicMediaUrls in lib/public-media-url.ts) — it is only ever
 * handed out for a field value belonging to an entry/assignment that ALREADY
 * passed its own PUBLISHED-only gate at the call site, so it doesn't need
 * its own per-object publish check. It reuses the exact same storage-read
 * path as /api/media/serve, just without requiring a login: a per-workspace
 * MinIO bucket already carries a public-read bucket policy (see
 * ensureBucketExists in r2.ts), so this doesn't expose anything beyond what
 * the storage layer itself already allows.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")
    if (!key) return NextResponse.json({ error: "Key is required" }, { status: 400 })

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    const rl = await rateLimit(`public:media:${ip}`, RATE_LIMITS.publicApi)
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 })
    }

    // Same key-shape validation as /api/media/serve: `<tenantId>/...` in the
    // platform bucket, or the legacy/local `upload/<tenant-slug>/...`.
    const parts = key.split("/").filter(Boolean)
    const isLegacyKey = parts[0] === "upload"
    const tenantRef = isLegacyKey ? parts[1] : parts[0]
    if (!tenantRef || !/^[a-z0-9-]+$/i.test(tenantRef) || parts.some((p) => p === ".." || p === ".")) {
      return NextResponse.json({ error: "Invalid key format" }, { status: 400 })
    }

    const tenant = await db.tenant.findUnique({
      where: isLegacyKey ? { slug: tenantRef } : { id: tenantRef },
      select: { id: true, slug: true },
    })
    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 })

    const tenantBase = path.join(process.cwd(), "public", "upload", tenant.slug)
    try {
      resolveWithinBase(tenantBase, ...parts.slice(isLegacyKey ? 2 : 1))
    } catch (e) {
      if (e instanceof SsrfError) {
        return NextResponse.json({ error: "Invalid key" }, { status: 400 })
      }
      throw e
    }

    const stored = await readFromStorage(key, tenant.id)
    if (!stored) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    const ext = path.extname(key).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
      ".mp4": "video/mp4",
    }
    const contentType = stored.contentType || contentTypeMap[ext] || "application/octet-stream"

    return new NextResponse(new Uint8Array(stored.buffer), {
      headers: {
        "Content-Type": contentType,
        // Every upload gets a fresh, timestamped key (see generateStorageKey
        // in r2.ts) — the bytes at a given key never change, so unlike the
        // private proxy's short-lived cache, this is safe to cache for a
        // long time (avoids re-serving old cached bytes under a reused key).
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch (error) {
    console.error("Error serving public media:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
