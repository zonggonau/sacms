"use client"

import dynamic from "next/dynamic"
const RichTextEditor = dynamic(() => import("@/components/rich-text-editor").then(mod => mod.RichTextEditor), { ssr: false })
import { Label } from "@/components/ui/label"

interface TextareaFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  label?: string
  error?: string
}

export function TextareaField({
  value,
  onChange,
  required,
  placeholder,
  label,
  error,
}: TextareaFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={`border border-border/80 rounded-xl overflow-hidden shadow-xs ${error ? "border-destructive" : ""}`}>
        <RichTextEditor
          value={value || ""}
          onChange={onChange}
          placeholder={placeholder || "Enter content..."}
          minHeight={140}
          simple
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
