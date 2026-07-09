"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Phone as PhoneIcon, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PhoneFieldProps {
  value: string | { code: string; number: string } | null
  onChange: (value: { code: string; number: string }) => void
  label?: string | React.ReactNode
  required?: boolean
  error?: string
}

const COUNTRY_CODES = [
  { code: "+62", country: "ID", flag: "🇮🇩", label: "Indonesia" },
  { code: "+1", country: "US", flag: "🇺🇸", label: "United States" },
  { code: "+44", country: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { code: "+81", country: "JP", flag: "🇯🇵", label: "Japan" },
  { code: "+82", country: "KR", flag: "🇰🇷", label: "South Korea" },
  { code: "+86", country: "CN", flag: "🇨🇳", label: "China" },
  { code: "+91", country: "IN", flag: "🇮🇳", label: "India" },
  { code: "+60", country: "MY", flag: "🇲🇾", label: "Malaysia" },
  { code: "+65", country: "SG", flag: "🇸🇬", label: "Singapore" },
  { code: "+66", country: "TH", flag: "🇹🇭", label: "Thailand" },
  { code: "+61", country: "AU", flag: "🇦🇺", label: "Australia" },
  { code: "+49", country: "DE", flag: "🇩🇪", label: "Germany" },
  { code: "+33", country: "FR", flag: "🇫🇷", label: "France" },
  { code: "+971", country: "AE", flag: "🇦🇪", label: "UAE" },
  { code: "+966", country: "SA", flag: "🇸🇦", label: "Saudi Arabia" },
]

const PHONE_PATTERN = /^[0-9\s\-()]+$/

export function PhoneField({
  value,
  onChange,
  label,
  required = false,
  error,
}: PhoneFieldProps) {
  const parsed = useMemo(() => {
    if (!value) return { code: "+62", number: "" }
    if (typeof value === "string") {
      // Try to extract country code
      const match = value.match(/^(\+\d{1,4})\s*(.*)$/)
      if (match) return { code: match[1], number: match[2] }
      return { code: "+62", number: value }
    }
    return { code: value.code || "+62", number: value.number || "" }
  }, [value])

  const [touched, setTouched] = useState(false)
  const isValid = !parsed.number || PHONE_PATTERN.test(parsed.number)
  const showError = touched && parsed.number && !isValid

  const selectedCountry = COUNTRY_CODES.find(c => c.code === parsed.code) || COUNTRY_CODES[0]

  return (
    <div className="space-y-2">
      {label && (
        typeof label === "string" ? (
          <Label className={cn(error || showError ? "text-destructive" : "")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        ) : label
      )}
      <div className="flex gap-1">
        <Select
          value={parsed.code}
          onValueChange={(code) => onChange({ ...parsed, code })}
        >
          <SelectTrigger className="w-[120px] h-11 shrink-0">
            <SelectValue>
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <span>{selectedCountry.flag}</span>
                <span>{selectedCountry.code}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[250px]">
            {COUNTRY_CODES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                <span className="flex items-center gap-2">
                  <span>{c.flag}</span>
                  <span className="font-medium">{c.code}</span>
                  <span className="text-muted-foreground text-xs">{c.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="tel"
            value={parsed.number}
            onChange={(e) => onChange({ ...parsed, number: e.target.value })}
            onBlur={() => setTouched(true)}
            placeholder="812-3456-7890"
            required={required}
            className={cn(
              "pl-9 h-11 font-mono text-sm",
              showError && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {parsed.number && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          )}
        </div>
      </div>
      {showError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Nomor telepon hanya boleh berisi angka, spasi, tanda hubung, dan tanda kurung
        </p>
      )}
      {parsed.number && isValid && (
        <p className="text-[10px] text-muted-foreground font-mono">
          Format tersimpan: {parsed.code} {parsed.number}
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
