"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateTimeFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  label?: string
  type?: "time" | "datetime" | "timestamp"
}

export function DateTimeField({
  value,
  onChange,
  required,
  placeholder,
  label,
  type = "datetime",
}: DateTimeFieldProps) {
  const getInputType = () => {
    switch (type) {
      case "time":
        return "time"
      case "datetime":
        return "datetime-local"
      case "timestamp":
        return "datetime-local"
      default:
        return "datetime-local"
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Input
        type={getInputType()}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}