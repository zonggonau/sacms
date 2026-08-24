"use client"

import { useLanguage } from "@/lib/i18n/context"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

export function LanguageSwitcher({ 
  className,
  compact = false 
}: { 
  className?: string
  compact?: boolean 
}) {
  const { locale, setLocale } = useLanguage()

  return (
    <div className={cn(
      "inline-flex items-center p-0.5 rounded-full bg-card/60 border border-border/60 shadow-xs backdrop-blur-md",
      className
    )}>
      <button
        type="button"
        onClick={() => setLocale("id")}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200",
          locale === "id"
            ? "bg-primary text-primary-foreground shadow-xs scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="Bahasa Indonesia"
      >
        <span className="text-xs leading-none">🇮🇩</span>
        {!compact && <span>ID</span>}
      </button>

      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200",
          locale === "en"
            ? "bg-primary text-primary-foreground shadow-xs scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="English"
      >
        <span className="text-xs leading-none">🇬🇧</span>
        {!compact && <span>EN</span>}
      </button>
    </div>
  )
}

export function MobileLanguageSwitcher() {
  const { locale, setLocale } = useLanguage()

  return (
    <div className="grid grid-cols-2 gap-2 p-1 bg-muted/30 border border-border/60 rounded-2xl">
      <button
        type="button"
        onClick={() => setLocale("id")}
        className={cn(
          "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
          locale === "id"
            ? "bg-primary text-primary-foreground shadow-xs font-black"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="text-sm leading-none">🇮🇩</span>
        <span>Bahasa Indonesia</span>
      </button>

      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all",
          locale === "en"
            ? "bg-primary text-primary-foreground shadow-xs font-black"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="text-sm leading-none">🇬🇧</span>
        <span>English</span>
      </button>
    </div>
  )
}
