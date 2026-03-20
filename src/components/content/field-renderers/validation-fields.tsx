"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ValidationFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  label?: string
  type?: "email" | "password" | "uid"
}

export function ValidationField({
  value,
  onChange,
  required,
  placeholder,
  label,
  type = "email",
}: ValidationFieldProps) {
  const getInputType = () => {
    switch (type) {
      case "email":
        return "email"
      case "password":
        return "password"
      case "uid":
        return "text"
      default:
        return "text"
    }
  }

  const getPlaceholder = () => {
    if (placeholder) return placeholder
    switch (type) {
      case "email":
        return "Enter email address"
      case "password":
        return "Enter password"
      case "uid":
        return "Enter unique identifier"
      default:
        return "Enter value"
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Input
        type={getInputType()}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={getPlaceholder()}
        required={required}
        autoComplete={type === "password" ? "new-password" : "off"}
      />
    </div>
  )
}