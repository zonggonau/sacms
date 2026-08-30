import React from "react"
import { cn } from "@/lib/utils"

export const BRAND_CONFIG = {
  name: "SaCMS",
  detail: "Smart Content Management System",
  slogan: "Build smarter. Manage easier. Scale faster.",
}

interface LogoProps {
  className?: string
  iconSize?: "sm" | "md" | "lg"
  showText?: boolean
  useOrange?: boolean
  customName?: string
  showDetail?: boolean
  customDetail?: string
  showTagline?: boolean
  customTagline?: string
}

export function Logo({
  className,
  iconSize = "md",
  showText = true,
  useOrange = true,
  customName,
  showDetail = false,
  customDetail,
  showTagline = false,
  customTagline,
}: LogoProps) {
  const sizeClasses = {
    sm: "text-xs p-1",
    md: "text-sm p-1.5",
    lg: "text-base p-2",
  }

  const textSizeClasses = {
    sm: "text-base sm:text-lg",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
  }

  const detailText = customDetail || BRAND_CONFIG.detail
  const taglineText = customTagline || BRAND_CONFIG.slogan

  return (
    <div className={cn("flex items-center gap-2.5 group", className)}>
      <div className={cn(
        "flex items-center justify-center text-white rounded-xl shadow-xs transition-transform group-hover:scale-105 bg-primary font-mono font-bold leading-none shrink-0",
        sizeClasses[iconSize]
      )}>
        <span>&lt;/&gt;</span>
      </div>
      
      {showText && (
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
    </div>
  )
}
