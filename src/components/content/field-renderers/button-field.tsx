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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-none bg-muted/30 border border-dashed border-muted-foreground/20">
        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
            Button Label
          </Label>
          <div className="relative">
            <MousePointer2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input
              value={initialValue.text}
              onChange={(e) => handleChange({ text: e.target.value })}
              placeholder="e.g. Learn More"
              className="pl-9 h-9 bg-background border-none shadow-none focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
            Redirect URL
          </Label>
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input
              value={initialValue.url}
              onChange={(e) => handleChange({ url: e.target.value })}
              placeholder="https://..."
              className="pl-9 h-9 bg-background border-none shadow-none focus-visible:ring-primary"
            />
          </div>
        </div>

        <div className="sm:col-span-2 flex items-center justify-end gap-4 mt-1">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="target-blank"
              className="h-3.5 w-3.5 rounded-none border-gray-300 text-primary focus:ring-primary"
              checked={initialValue.target === "_blank"}
              onChange={(e) => handleChange({ target: e.target.checked ? "_blank" : "_self" })}
            />
            <Label htmlFor="target-blank" className="text-[10px] font-bold uppercase text-muted-foreground cursor-pointer flex items-center gap-1">
              Open in new tab <ExternalLink className="h-2.5 w-2.5" />
            </Label>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-destructive pl-1 font-medium">{error}</p>}
    </div>
  )
}
