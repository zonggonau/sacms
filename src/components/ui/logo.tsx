import React from "react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  iconSize?: "sm" | "md" | "lg"
  showText?: boolean
  useOrange?: boolean
}

export function Logo({ className, iconSize = "md", showText = true, useOrange = true }: LogoProps) {
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
    <div className={cn("flex items-center gap-2 group", className)}>
      <div className={cn(
        "flex items-center justify-center text-white rounded-md shadow-sm transition-transform group-hover:scale-105",
        useOrange ? "bg-orange-500" : "bg-indigo-600",
        sizeClasses[iconSize]
      )}>
        <span className="font-mono font-bold leading-none">&lt;/&gt;</span>
      </div>
      
      {showText && (
        <div className={cn("font-sans tracking-tight", textSizeClasses[iconSize])}>
          <span className="font-extrabold text-slate-900 dark:text-white">Sa</span>
          <span className="font-medium text-slate-600 dark:text-slate-300">CMS</span>
        </div>
      )}
    </div>
  )
}

