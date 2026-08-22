import React from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  iconSize?: "sm" | "md" | "lg"
  showText?: boolean
  useOrange?: boolean
  customName?: string
}

export function Logo({ className, iconSize = "md", showText = true, useOrange = true, customName }: LogoProps) {
  const sizeClasses = {
    sm: "text-xs p-1",
    md: "text-sm p-1.5",
    lg: "text-base p-2",
  }

  const textSizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  }

  return (
    <div className={cn("flex items-center gap-2.5 group", className)}>
      <div className={cn(
        "flex items-center justify-center text-white rounded-xl shadow-xs transition-transform group-hover:scale-105 bg-primary font-mono font-bold leading-none shrink-0",
        sizeClasses[iconSize]
      )}>
        <span>&lt;/&gt;</span>
      </div>
      
      {showText && (
        <div className={cn("font-sans tracking-tight", textSizeClasses[iconSize])}>
          {customName ? (
            <span className="font-extrabold text-foreground">{customName}</span>
          ) : (
            <>
              <span className="font-black text-foreground">Sa</span>
              <span className="font-bold text-primary">CMS</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

