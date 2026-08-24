"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MousePointer2, Link2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

interface ButtonValue {
  text: string
  url: string
  target?: "_blank" | "_self"
}

interface ButtonFieldProps {
  value: ButtonValue | null | string
  onChange: (value: ButtonValue) => void
  label?: React.ReactNode
  required?: boolean
  error?: string
}

export function ButtonField({
  value,
  onChange,
  label,
  required,
  error,
}: ButtonFieldProps) {
  // Handle if value comes as string (shouldn't happen with new system but for safety)
  let initialValue: ButtonValue = { text: "", url: "", target: "_self" }
  if (value) {
    if (typeof value === "string") {
      try {
        initialValue = JSON.parse(value)
      } catch {
        initialValue = { text: value, url: "" }
      }
    } else {
      initialValue = { ...initialValue, ...value }
    }
  }

  const handleChange = (updates: Partial<ButtonValue>) => {
    onChange({ ...initialValue, ...updates })
  }

  return (
    <div className="space-y-3">
      {label && (
        <div className="flex items-center justify-between">
          {typeof label === "string" ? (
            <Label className={cn("text-sm font-bold", error && "text-destructive")}>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          ) : (
            label
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-muted/20 border border-dashed border-border/80">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground pl-1">
            Label Tombol
          </Label>
          <div className="relative">
            <MousePointer2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input
              value={initialValue.text}
              onChange={(e) => handleChange({ text: e.target.value })}
              placeholder="Contoh: Pelajari Selengkapnya"
              className="pl-9 h-9 bg-background border border-border/70 rounded-xl text-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground pl-1">
            URL Tautan
          </Label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input
              value={initialValue.url}
              onChange={(e) => handleChange({ url: e.target.value })}
              placeholder="https://..."
              className="pl-9 h-9 bg-background border border-border/70 rounded-xl text-xs"
            />
          </div>
        </div>

        <div className="sm:col-span-2 flex items-center justify-end gap-4 mt-1">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="target-blank"
              className="h-4 w-4 rounded-md border-border text-primary focus:ring-primary cursor-pointer"
              checked={initialValue.target === "_blank"}
              onChange={(e) => handleChange({ target: e.target.checked ? "_blank" : "_self" })}
            />
            <Label htmlFor="target-blank" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              Buka di tab baru <ExternalLink className="h-3 w-3" />
            </Label>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive pl-1 font-medium">{error}</p>}
    </div>
  )
}
