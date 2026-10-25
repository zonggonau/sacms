"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

export const BRAND_CONFIG = {
  name: "SaCMS",
  detail: "Smart CMS",
  slogan: "Build smarter. Manage easier. Scale faster.",
}

interface LogoProps {
  className?: string
  iconSize?: "sm" | "md" | "lg" | "xl"
  /** "compact" (default): small icon image + separately-rendered "SaCMS"
   *  text — fits narrow sidebars/badges. "wide": the real combined
   *  icon+wordmark lockup artwork (public/assets/img/header-footer-*.png)
   *  as a single image — for header/footer navbars with room to spare.
   *  Falls back to "compact" whenever customName overrides the text, since
   *  the wide lockup's wordmark is baked into the image and can't be
   *  swapped for custom text. */
  variant?: "compact" | "wide"
  /** Only applies to variant="wide". "auto" (default) follows the resolved
   *  theme like the compact variant does; pin to "black" or "white" to
   *  always use that lockup regardless of theme (e.g. a navbar whose own
   *  background stays light in both themes). */
  wideColor?: "auto" | "black" | "white"
  showText?: boolean
  useOrange?: boolean
  customName?: string
  showDetail?: boolean
  customDetail?: string
  showTagline?: boolean
  customTagline?: string
}

// Real brand mark. "compact": public/assets/img/sacms-icon-{black,white}.png
// (square crops of the full lockup, icon only — this component renders its
// own "SaCMS" text alongside). "wide": public/assets/img/header-footer-
// {black,white}.png (the icon+wordmark combined artwork, 2.5:1 aspect).
// Both variants' accent facets are drawn black or white in the source art,
// so which one's picked follows the resolved theme the same way the
// compact variant's text does via text-foreground.
const ICON_PX = { sm: 24, md: 32, lg: 40, xl: 64 }
const WIDE_ASPECT = 1983 / 793

export function Logo({
  className,
  iconSize = "md",
  variant = "compact",
  wideColor = "auto",
  showText = true,
  useOrange = true,
  customName,
  showDetail = false,
  customDetail,
  showTagline = false,
  customTagline,
}: LogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  const textSizeClasses = {
    sm: "text-base sm:text-lg",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
    xl: "text-2xl sm:text-3xl",
  }

  const detailText = customDetail || BRAND_CONFIG.detail
  const taglineText = customTagline || BRAND_CONFIG.slogan
  const px = ICON_PX[iconSize]
  const useWide = variant === "wide" && !customName

  return (
    <div className={cn("flex items-center gap-2.5 group", className)}>
      {useWide ? (
        <Image
          src={
            wideColor === "black"
              ? "/assets/img/header-footer-black.png"
              : wideColor === "white"
              ? "/assets/img/header-footer-white.png"
              : isDark
              ? "/assets/img/header-footer-white.png"
              : "/assets/img/header-footer-black.png"
          }
          alt="SaCMS"
          width={Math.round(px * WIDE_ASPECT)}
          height={px}
          priority
          className="shrink-0 w-auto transition-transform group-hover:scale-105 object-contain"
          style={{ height: px }}
        />
      ) : (
        <Image
          src={isDark ? "/assets/img/sacms-icon-white.png" : "/assets/img/sacms-icon-black.png"}
          alt="SaCMS"
          width={px}
          height={px}
          priority
          className="shrink-0 w-auto transition-transform group-hover:scale-105 object-contain"
          style={{ height: px }}
        />
      )}

      {showText && !useWide && (
        <div className="flex flex-col justify-center min-w-0">
          <div className={cn("font-sans tracking-tight leading-none", textSizeClasses[iconSize])}>
            {customName ? (
              <span className="font-extrabold text-foreground">{customName}</span>
            ) : (
              <>
                <span className="font-black text-foreground">Sa</span>
                <span className="font-bold text-primary">CMS</span>
              </>
            )}
          </div>

          {showDetail && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground tracking-tight leading-tight mt-0.5 truncate">
              {detailText}
            </span>
          )}

          {showTagline && (
            <span className="text-[9px] sm:text-[10px] font-medium text-primary/80 tracking-normal leading-tight mt-0.5 italic">
              {taglineText}
            </span>
          )}
        </div>
      )}

      {useWide && (showDetail || showTagline) && (
        <div className="flex flex-col justify-center min-w-0">
          {showDetail && (
            <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground tracking-tight leading-tight truncate">
              {detailText}
            </span>
          )}
          {showTagline && (
            <span className="text-[9px] sm:text-[10px] font-medium text-primary/80 tracking-normal leading-tight italic">
              {taglineText}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
