"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface TextFieldProps {
  value: string | number
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  error?: string
  type?: "text" | "number" | "email" | "password"
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  required = false,
  multiline = false,
  rows = 3,
  error,
  type = "text",
}: TextFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {multiline ? (
        <Textarea
          value={value?.toString() || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={error ? "border-destructive" : ""}
        />
      ) : (
        <Input
          type={type}
          value={value?.toString() || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={error ? "border-destructive" : ""}
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}