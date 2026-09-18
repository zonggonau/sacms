"use client"

import { useRouter, usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Sparkles, Code2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardModeSwitcherProps {
  currentMode?: "aibuilder" | "developer"
  className?: string
}

export function DashboardModeSwitcher({
  currentMode,
  className,
}: DashboardModeSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session } = useSession()

  const isRegularUser = session?.user?.role === "user"

  if (isRegularUser) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary/10 border border-primary/20 rounded-2xl text-xs font-bold text-primary backdrop-blur-sm shadow-xs",
          className
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>AI Studio</span>
      </div>
    )
  }

  const activeMode = currentMode || (pathname?.startsWith("/aibuilder") ? "aibuilder" : "developer")

  return (
    <div
      className={cn(
        "inline-flex items-center p-1 bg-muted/70 dark:bg-muted/40 border border-border/80 rounded-2xl shadow-xs backdrop-blur-sm",
        className
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (activeMode !== "aibuilder") {
            router.push("/aibuilder")
          }
        }}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
          activeMode === "aibuilder"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>AI Builder</span>
      </button>

      <button
        type="button"
        onClick={() => {
          if (activeMode !== "developer") {
            router.push("/dashboard")
          }
        }}
        className={cn(
          "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none",
          activeMode === "developer"
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
      >
        <Code2 className="h-3.5 w-3.5" />
        <span>Developer</span>
      </button>
    </div>
  )
}
