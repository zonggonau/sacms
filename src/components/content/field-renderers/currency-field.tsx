"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface CurrencyFieldProps {
  value: number | null | undefined
  onChange: (value: number | null) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  currency?: string
}

export function CurrencyField({
  value,
  onChange,
  label,
  placeholder = "0.00",
  required = false,
  error,
  currency = "IDR"
}: CurrencyFieldProps) {
  const [displayValue, setDisplayValue] = useState<string>("")

  // Initialize display value on mount or when external value changes
  useEffect(() => {
    if (value !== null && value !== undefined) {
      setDisplayValue(formatNumber(value))
    } else {
      setDisplayValue("")
    }
  }, [value])

  const formatNumber = (num: number | string) => {
    if (num === null || num === undefined || num === "") return ""
    // Remove non-numeric characters for processing
    const cleanNum = String(num).replace(/[^\d.-]/g, "")
    if (isNaN(Number(cleanNum))) return ""
    
    // Format with commas
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number(cleanNum))
  }

  const parseNumber = (val: string): number | null => {
    const clean = val.replace(/[^\d.-]/g, "")
    if (!clean) return null
    return Number(clean)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    // Allow user to type decimal point
    if (val.endsWith('.')) {
      setDisplayValue(val)
      return
    }
    
    const parsed = parseNumber(val)
    if (parsed !== null) {
      setDisplayValue(formatNumber(parsed))
      onChange(parsed)
    } else {
      setDisplayValue("")
      onChange(null)
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label className={cn(error ? "text-destructive" : "")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted-foreground font-medium">
          {currency}
        </div>
        <Input
          type="text"
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          className={cn(
            "pl-12 rounded-none",
            error ? "border-destructive focus-visible:ring-destructive" : ""
          )}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
