"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MapPin, Palette, Code } from "lucide-react"

interface AdvancedFieldProps {
  value: unknown
  onChange: (value: unknown) => void
  required?: boolean
  placeholder?: string
  label?: string
  type?: "json" | "color" | "location"
}

export function AdvancedField({
  value,
  onChange,
  required,
  placeholder,
  label,
  type = "json",
}: AdvancedFieldProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value
    
    switch (type) {
      case "json":
        try {
          if (val === "") {
            onChange("")
          } else {
            onChange(JSON.parse(val))
          }
        } catch (error) {
          onChange(val) // Keep as string while invalid JSON
        }
        break
      case "color":
        onChange(val)
        break
      case "location":
        onChange(val)
        break
      default:
        onChange(val)
    }
  }

  switch (type) {
    case "json":
      return (
        <div className="space-y-2">
          {label && (
            <Label>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <div className="relative">
            <Code className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Textarea
              value={typeof value === "object" ? JSON.stringify(value, null, 2) : (value as string) || ""}
              onChange={handleChange}
              placeholder={placeholder || '{\n  "key": "value"\n}'}
              rows={6}
              required={required}
              className="font-mono pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">Enter valid JSON data</p>
        </div>
      )

    case "color":
      return (
        <div className="space-y-2">
          {label && (
            <Label>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={value as string || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              required={required}
              className="w-20 h-10 p-1 cursor-pointer"
            />
            <Input
              value={value as string || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              required={required}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-muted-foreground">Pick a color or enter hex value</p>
        </div>
      )

    case "location":
      return (
        <div className="space-y-2">
          {label && (
            <Label>
              {label}
              {required && <span className="text-destructive ml-1">*</span>}
            </Label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.000001"
                placeholder="Latitude"
                value={typeof value === "object" ? (value as { lat?: number }).lat || "" : ""}
                onChange={(e) => {
                  const current = typeof value === "object" ? value : {}
                  onChange({
                    ...current,
                    lat: parseFloat(e.target.value) || 0,
                  })
                }}
                required={required}
                className="pl-9"
              />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.000001"
                placeholder="Longitude"
                value={typeof value === "object" ? (value as { lng?: number }).lng || "" : ""}
                onChange={(e) => {
                  const current = typeof value === "object" ? value : {}
                  onChange({
                    ...current,
                    lng: parseFloat(e.target.value) || 0,
                  })
                }}
                required={required}
                className="pl-9"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Enter GPS coordinates</p>
        </div>
      )

    default:
      return null
  }
}