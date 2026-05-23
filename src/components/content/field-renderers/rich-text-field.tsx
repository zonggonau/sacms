"use client"

import { RichTextEditor } from "@/components/rich-text-editor"
import { Label } from "@/components/ui/label"

interface RichTextFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  tenantSlug?: string
}

export function RichTextField({
  value,
  onChange,
  label,
  placeholder = "Enter content...",
  required = false,
  error,
  tenantSlug,
}: RichTextFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={`border rounded-none overflow-hidden ${error ? "border-destructive" : ""}`}>
        <RichTextEditor
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={300}
          tenantSlug={tenantSlug}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
