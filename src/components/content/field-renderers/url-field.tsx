"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Globe, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface UrlFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string | React.ReactNode
  placeholder?: string
  required?: boolean
  error?: string
}

const URL_PATTERN = /^(https?:\/\/|mailto:|tel:)[\S]+$/i
const PARTIAL_URL_PATTERN = /^(https?:\/\/|mailto:|tel:|www\.)/i

export function UrlField({
  value,
  onChange,
  label,
  placeholder = "https://example.com",
  required = false,
  error,
}: UrlFieldProps) {
  const [touched, setTouched] = useState(false)

  const isValid = !value || URL_PATTERN.test(value)
  const showError = touched && value && !isValid

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value
    // Auto-prefix www. with https://
    if (val.startsWith("www.")) {
      val = "https://" + val
    }
    onChange(val)
  }

  const openUrl = () => {
    if (value && isValid) {
      window.open(value, "_blank", "noopener,noreferrer")
    }
  }

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
      <div className="relative flex gap-1">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="url"
            value={value || ""}
            onChange={handleChange}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            required={required}
            className={cn(
              "pl-9 pr-8 h-11 font-mono text-sm",
              showError && "border-destructive focus-visible:ring-destructive"
            )}
          />
          {value && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          )}
        </div>
        {value && isValid && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={openUrl}
            title="Open URL"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
      {showError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          URL harus dimulai dengan http://, https://, mailto:, atau tel:
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
