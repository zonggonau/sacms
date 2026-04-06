"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Fingerprint, RefreshCcw, Link as LinkIcon, Link2Off } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

/**
 * Generates a URL-friendly slug from a string (Client-side version)
 */
export function slugify(text: string): string {
  if (!text) return ""
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

interface SlugFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  label?: string | React.ReactNode
  placeholder?: string
  sourceValue?: string // The value to generate slug from (e.g. title)
  autoGenerate?: boolean
}

export function SlugField({
  value,
  onChange,
  required,
  label,
  placeholder,
  sourceValue,
  autoGenerate: initialAutoGenerate = true
}: SlugFieldProps) {
  const [isAuto, setIsAuto] = useState(initialAutoGenerate && !value)

  // Auto-generate slug when sourceValue changes, if isAuto is true
  useEffect(() => {
    if (isAuto && sourceValue) {
      const newSlug = slugify(sourceValue)
      if (newSlug !== value) {
        onChange(newSlug)
      }
    }
  }, [sourceValue, isAuto, value, onChange])

  const handleManualChange = (newValue: string) => {
    setIsAuto(false) // Disable auto-gen once user types manually
    onChange(newValue)
  }

  const toggleAuto = () => {
    const nextAuto = !isAuto
    setIsAuto(nextAuto)
    if (nextAuto && sourceValue) {
      onChange(slugify(sourceValue))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {typeof label === 'string' ? (
          <Label className="text-sm font-bold">
            {label} {required && "*"}
          </Label>
        ) : label}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className={`h-7 text-[10px] font-bold uppercase gap-1 transition-colors ${
            isAuto 
              ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" 
              : "text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          }`}
          onClick={(e) => {
            e.preventDefault();
            toggleAuto();
          }}
          title={isAuto ? "Disable auto-generation" : "Enable auto-generation from title"}
        >
          {isAuto ? (
            <>
              <LinkIcon className="h-3 w-3" /> Linked to source
            </>
          ) : (
            <>
              <Link2Off className="h-3 w-3" /> Manual entry
            </>
          )}
        </Button>
      </div>
      <div className="relative">
        <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value || ""}
          onChange={(e) => handleManualChange(e.target.value)}
          placeholder={placeholder || "enter-slug-here"}
          required={required}
          className={`pl-9 font-mono text-sm border-emerald-100/50 ${
            isAuto ? "bg-emerald-50/20" : "bg-card"
          }`}
        />
      </div>
    </div>
  )
}
