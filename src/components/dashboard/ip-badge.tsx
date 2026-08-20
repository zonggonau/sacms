"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isPrivateIp, getCountryFlagEmoji, GeoIpResult } from "@/lib/geoip"
import { cn } from "@/lib/utils"
import { Copy, Check, Globe } from "lucide-react"

// Client-side cache to prevent redundant requests across components
const clientGeoCache = new Map<string, GeoIpResult>()
const pendingLookups = new Map<string, Promise<GeoIpResult>>()

async function fetchGeoIpClient(ip: string): Promise<GeoIpResult> {
  const cleanIp = (ip || "::1").trim()
  if (clientGeoCache.has(cleanIp)) {
    return clientGeoCache.get(cleanIp)!
  }

  if (isPrivateIp(cleanIp)) {
    const localRes: GeoIpResult = {
      ip: cleanIp,
      isPrivate: true,
      countryCode: "LOCAL",
      countryName: "Localhost / Private Network",
      city: "Local Network",
      flag: "🏠",
    }
    clientGeoCache.set(cleanIp, localRes)
    return localRes
  }

  if (pendingLookups.has(cleanIp)) {
    return pendingLookups.get(cleanIp)!
  }

  const lookupPromise = (async () => {
    try {
      const res = await fetch(`/api/geoip?ip=${encodeURIComponent(cleanIp)}`)
      if (res.ok) {
        const data: GeoIpResult = await res.json()
        clientGeoCache.set(cleanIp, data)
        return data
      }
    } catch {
      // Ignore network errors
    }

    const fallback: GeoIpResult = {
      ip: cleanIp,
      isPrivate: false,
      countryCode: "XX",
      countryName: "Unknown Location",
      flag: "🌐",
    }
    clientGeoCache.set(cleanIp, fallback)
    return fallback
  })().finally(() => {
    pendingLookups.delete(cleanIp)
  })

  pendingLookups.set(cleanIp, lookupPromise)
  return lookupPromise
}

interface IpBadgeProps {
  ipAddress?: string | null
  className?: string
  showCountryName?: boolean
  compact?: boolean
  showCopy?: boolean
}

export function IpBadge({
  ipAddress,
  className,
  showCountryName = false,
  compact = false,
  showCopy = false,
}: IpBadgeProps) {
  const ip = (ipAddress || "::1").trim()
  const [geo, setGeo] = useState<GeoIpResult>(() => {
    if (clientGeoCache.has(ip)) return clientGeoCache.get(ip)!
    if (isPrivateIp(ip)) {
      return {
        ip,
        isPrivate: true,
        countryCode: "LOCAL",
        countryName: "Localhost / Private Network",
        city: "Local Network",
        flag: "🏠",
      }
    }
    return {
      ip,
      isPrivate: false,
      countryCode: "XX",
      countryName: "Loading...",
      flag: "🌐",
    }
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let isMounted = true
    fetchGeoIpClient(ip).then((data) => {
      if (isMounted) setGeo(data)
    })
    return () => {
      isMounted = false
    }
  }, [ip])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(ip)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tooltipText = (
    <div className="text-xs space-y-1 p-0.5">
      <div className="flex items-center gap-1.5 font-bold">
        <span className="text-base">{geo.flag}</span>
        <span>{geo.countryName || "Unknown"}</span>
        {geo.countryCode && geo.countryCode !== "XX" && (
          <span className="text-[10px] text-muted-foreground uppercase">({geo.countryCode})</span>
        )}
      </div>
      {geo.city && geo.city !== "Local Network" && (
        <p className="text-[11px] text-muted-foreground">City: {geo.city}{geo.region ? `, ${geo.region}` : ""}</p>
      )}
      {geo.isp && (
        <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">ISP: {geo.isp}</p>
      )}
      <p className="text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">IP: {ip}</p>
    </div>
  )

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none border border-border bg-muted/40 font-mono text-[11px] text-foreground hover:bg-muted/70 transition-colors select-none",
              className
            )}
          >
            {/* Country Flag */}
            <span className="text-sm shrink-0 leading-none select-none" role="img" aria-label={geo.countryName || "flag"}>
              {geo.flag}
            </span>

            {/* IP Address */}
            <span className="truncate">{ip}</span>

            {/* Country Code or Name */}
            {geo.countryCode && geo.countryCode !== "XX" && (
              <span className="text-[9px] font-sans font-bold uppercase text-muted-foreground bg-background/80 px-1 py-0.2 rounded-none border border-border/60">
                {geo.countryCode === "LOCAL" ? "LOCAL" : geo.countryCode}
              </span>
            )}

            {showCountryName && geo.countryName && geo.countryCode !== "LOCAL" && geo.countryCode !== "XX" && (
              <span className="text-[10px] font-sans text-muted-foreground truncate max-w-[120px]">
                {geo.countryName}
              </span>
            )}

            {/* Copy Button (Optional) */}
            {showCopy && (
              <button
                type="button"
                onClick={handleCopy}
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy IP"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="rounded-none border border-border bg-popover shadow-md">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
