"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  options?: string[]
  jsonPath?: string // Path to fetch JSON data (e.g., "/api/categories")
  tenantSlug?: string // For API calls
}

export function SelectField({
  value,
  onChange,
  label,
  placeholder = "Select an option...",
  required = false,
  error,
  options = [],
  jsonPath,
  tenantSlug,
}: SelectFieldProps) {
  const [dynamicOptions, setDynamicOptions] = useState<string[]>(options)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!jsonPath || !tenantSlug) {
      setDynamicOptions(options)
      return
    }

    const fetchOptions = async () => {
      setLoading(true)
      try {
        const response = await fetch(jsonPath)
        if (response.ok) {
          const data = await response.json()
          // Handle different data formats
          const opts = Array.isArray(data) ? data : data.options || []
          setDynamicOptions(opts)
        }
      } catch (error) {
        console.error("Error fetching options:", error)
        setDynamicOptions(options) // Fallback to static options
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [jsonPath, tenantSlug, options])

  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className={error ? "border-destructive" : ""}>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>
        <SelectContent>
          {dynamicOptions.length === 0 ? (
            <SelectItem value="no-options" disabled>
              No options available
            </SelectItem>
          ) : (
            dynamicOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
