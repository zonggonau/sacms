"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Languages } from "lucide-react"

interface Locale {
  id: string
  locale: string
  name: string
  isDefault: boolean
}

interface LocaleSwitcherProps {
  tenantSlug: string
  currentLocale: string
  onLocaleChange: (locale: string) => void
  compact?: boolean
}

export function LocaleSwitcher({ tenantSlug, currentLocale, onLocaleChange, compact = false }: LocaleSwitcherProps) {
  const [locales, setLocales] = useState<Locale[]>([])

  useEffect(() => {
    async function fetchLocales() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/locales`)
        if (res.ok) {
          const data = await res.json()
          setLocales(data.locales || [])
        }
      } catch (err) {
        console.error("Failed to fetch locales:", err)
      }
    }
    fetchLocales()
  }, [tenantSlug])

  if (locales.length <= 1) return null

  if (compact) {
    return (
      <Select value={currentLocale} onValueChange={onLocaleChange}>
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <Languages className="h-3 w-3 mr-1" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((loc) => (
            <SelectItem key={loc.id} value={loc.locale} className="text-xs">
              {loc.locale.toUpperCase()} — {loc.name}
              {loc.isDefault && " (default)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1 bg-muted/30">
      {locales.map((loc) => (
        <Button
          key={loc.id}
          variant={currentLocale === loc.locale ? "default" : "ghost"}
          size="sm"
          className={`h-7 px-3 text-xs ${currentLocale === loc.locale
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : "text-muted-foreground"
          }`}
          onClick={() => onLocaleChange(loc.locale)}
        >
          {loc.locale.toUpperCase()}
          {loc.isDefault && <Badge variant="outline" className="ml-1 text-[8px] h-3 px-1">DEFAULT</Badge>}
        </Button>
      ))}
    </div>
  )
}
