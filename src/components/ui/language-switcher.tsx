"use client"

import { Globe } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/context"
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/dictionaries"

const SHORT: Record<Locale, string> = { id: "ID", en: "EN" }

/** Compact ID/EN switcher for headers and toolbars. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 gap-1.5 rounded-full px-2.5 text-xs font-bold", className)}
          aria-label="Change language"
        >
          <Globe className="h-3.5 w-3.5" />
          {SHORT[locale]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => setLocale(l)}
            className={cn("text-xs", l === locale && "font-bold text-primary")}
          >
            <span className="mr-2 inline-block w-6 font-mono text-[10px] text-muted-foreground">
              {SHORT[l]}
            </span>
            {LOCALE_LABELS[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Full-width variant for mobile menus. */
export function MobileLanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useLanguage()

  return (
    <div className={cn("flex gap-2", className)}>
      {LOCALES.map((l) => (
        <Button
          key={l}
          type="button"
          variant={l === locale ? "default" : "outline"}
          size="sm"
          onClick={() => setLocale(l)}
          className="flex-1 rounded-xl text-xs font-bold"
        >
          {LOCALE_LABELS[l]}
        </Button>
      ))}
    </div>
  )
}
