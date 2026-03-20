"use client"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface BooleanFieldProps {
  value: boolean
  onChange: (value: boolean) => void
  label?: string
  required?: boolean
  error?: string
}

export function BooleanField({
  value,
  onChange,
  label,
  required = false,
  error,
}: BooleanFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Switch
          checked={value}
          onCheckedChange={onChange}
          className={error ? "border-destructive" : ""}
        />
        {label && (
          <Label className={error ? "text-destructive" : ""}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}