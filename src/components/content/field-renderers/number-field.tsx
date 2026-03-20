"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface NumberFieldProps {
  value: string | number
  onChange: (value: string | number) => void
  required?: boolean
  placeholder?: string
  label?: string
  type?: "integer" | "decimal" | "biginteger" | "float"
}

export function NumberField({
  value,
  onChange,
  required,
  placeholder,
  label,
  type = "integer",
}: NumberFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === "") {
      onChange("")
      return
    }

    switch (type) {
      case "integer":
      case "biginteger":
        const intVal = parseInt(val, 10)
        onChange(isNaN(intVal) ? val : intVal)
        break
      case "decimal":
      case "float":
        const floatVal = parseFloat(val)
        onChange(isNaN(floatVal) ? val : floatVal)
        break
      default:
        onChange(val)
    }
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Input
        type="number"
        step={type === "integer" || type === "biginteger" ? "1" : "0.01"}
        value={value || ""}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
      />
    </div>
  )
}