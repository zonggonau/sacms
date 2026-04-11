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

interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  options?: (string | SelectOption)[]
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
  const [dynamicOptions, setDynamicOptions] = useState<(string | SelectOption)[]>(options)
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
          
          // Normalize options to handle objects from API
          const normalizedOpts = opts.map((opt: any) => {
            if (typeof opt === 'string') return opt
            if (typeof opt === 'object' && opt !== null) {
              return {
                label: opt.label || opt.name || opt.title || String(Object.values(opt)[0]),
                value: String(opt.value || opt.id || opt.slug || Object.values(opt)[0])
              }
            }
            return String(opt)
          })
          
          setDynamicOptions(normalizedOpts)
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
            dynamicOptions.map((option, index) => {
              const optLabel = typeof option === 'string' ? option : option.label
              const optValue = typeof option === 'string' ? option : option.value
              const optKey = typeof option === 'string' ? `opt-${index}-${option}` : `opt-${index}-${option.value}`
              
              return (
                <SelectItem key={optKey} value={optValue}>
                  {optLabel}
                </SelectItem>
              )
            })
          )}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
