import { NextRequest, NextResponse } from "next/server"
import { lookupGeoIp } from "@/lib/geoip"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const ip = searchParams.get("ip")
    const ipsParam = searchParams.get("ips")

    // Single IP lookup
    if (ip) {
      const result = await lookupGeoIp(ip)
      return NextResponse.json(result)
    }

    // Batch IPs lookup (comma-separated, max 30 IPs)
    if (ipsParam) {
      const rawIps = ipsParam.split(",").map((s) => s.trim()).filter(Boolean)
      const uniqueIps = Array.from(new Set(rawIps)).slice(0, 30)

      const results = await Promise.all(uniqueIps.map((targetIp) => lookupGeoIp(targetIp)))

      const map: Record<string, any> = {}
      results.forEach((res) => {
        map[res.ip] = res
      })

      return NextResponse.json({ results: map })
    }

    // Fallback: detect client requester IP
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                     request.headers.get("x-real-ip") || 
                     "127.0.0.1"
    const result = await lookupGeoIp(clientIp)
    return NextResponse.json(result)
  } catch (error) {
    console.error("GeoIP API error:", error)
    return NextResponse.json({ error: "Failed to resolve IP location" }, { status: 500 })
  }
}
