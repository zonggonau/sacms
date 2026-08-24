"use client"

import dynamic from "next/dynamic"
const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then(mod => mod.RichTextEditor), { ssr: false })
import { Label } from "@/components/ui/label"

interface RichTextFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  tenantSlug?: string
  documentId?: string
  fieldSlug?: string
}

export function RichTextField({
  value,
  onChange,
  label,
  placeholder = "Enter content...",
  required = false,
  error,
  tenantSlug,
  documentId,
  fieldSlug,
}: RichTextFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={`border border-border/80 rounded-2xl overflow-hidden shadow-xs ${error ? "border-destructive" : ""}`}>
        <RichTextEditor
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder}
          minHeight={300}
          tenantSlug={tenantSlug}
          documentId={documentId}
          fieldSlug={fieldSlug}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
