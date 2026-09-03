import { NextRequest, NextResponse } from "next/server"
import sharp from "sharp"
import { getRedis } from "@/lib/redis"
import { assertPublicUrl, SsrfError } from "@/lib/safe-url"

/**
 * Image Transformation API
 * Usage: /api/media/transform?url=<encoded_url>&w=300&h=300&q=80
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  
  const imageUrl = searchParams.get("url")
  const width = parseInt(searchParams.get("w") || "0")
  const height = parseInt(searchParams.get("h") || "0")
  const quality = parseInt(searchParams.get("q") || "80")
  
  if (!imageUrl) {
    return new NextResponse("Missing image URL", { status: 400 })
  }

  // SSRF guard: only fetch plain http(s) URLs that resolve to a public address.
  let safeUrl: URL
  try {
    safeUrl = await assertPublicUrl(imageUrl, { allowHttp: true })
  } catch (e) {
    return new NextResponse(
      e instanceof SsrfError ? e.message : "Invalid image URL",
      { status: 400 },
    )
  }
  const fetchUrl = safeUrl.toString()

  const cacheKey = `img_transform:${Buffer.from(fetchUrl).toString('base64').substring(0, 32)}:w${width}:h${height}:q${quality}`
  const redis = getRedis()

  // 1. Try to serve from Redis cache
  if (redis) {
    const cachedB64 = await redis.get<string>(cacheKey).catch(() => null)
    if (cachedB64) {
      const cachedBuffer = Buffer.from(cachedB64, 'base64')
      return new NextResponse(cachedBuffer as unknown as BodyInit, {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Cache": "HIT"
        }
      })
    }
  }

  try {
    // 2. Fetch original image (redirects disabled so a public URL can't bounce to a private one)
    const response = await fetch(fetchUrl, { redirect: "error" })
    if (!response.ok) throw new Error("Failed to fetch original image")
    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) throw new Error("Not an image")
    
    const arrayBuffer = await response.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // 3. Process with Sharp
    let transformer = sharp(inputBuffer)

    if (width > 0 || height > 0) {
      transformer = transformer.resize({
        width: width > 0 ? width : undefined,
        height: height > 0 ? height : undefined,
        fit: "cover",
        withoutEnlargement: true
      })
    }

    // Always convert to WebP for best performance
    const outputBuffer = await transformer
      .webp({ quality })
      .toBuffer()

    // 4. Save to cache (TTL 7 days)
    if (redis) {
      const base64Output = outputBuffer.toString('base64')
      await redis.setex(cacheKey, 60 * 60 * 24 * 7, base64Output).catch(() => {})
    }

    // 5. Return response
    return new NextResponse(outputBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Cache": "MISS"
      }
    })

  } catch (error: any) {
    console.error("[Image Transform] Error:", error.message)
    return new NextResponse("Image transformation failed", { status: 500 })
  }
}
