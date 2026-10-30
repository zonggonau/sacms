"use client"

import { useEffect, useState, useMemo } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { normalizeSelectOptions, type SelectOption } from "@/lib/select-options"

export type { SelectOption }

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  options?: any
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
  // Memoized, not stateful — a caller that re-creates `options` as a new
  // array/object literal every render (e.g. `component-field.tsx`'s
  // `renderInnerField`, which does `let selectOptions = field.options ?
  // normalizeSelectOptions(field.options) : []`) must never feed that
  // instability into a `useEffect`+`setState` pair, or the effect re-fires
  // every render and queues a state update every time — an infinite
  // re-render loop ("Maximum update depth exceeded") regardless of whether
  // the normalized *contents* actually changed. `useMemo` alone recomputes
  // the derived value safely without ever calling setState.
  const staticOptions = useMemo(() => normalizeSelectOptions(options), [options])
  // Only for the async jsonPath-fetch case — kept as separate state so a
  // fetch failure/absence can fall back to `staticOptions` below, without
  // re-deriving (and so re-triggering) off the unstable `options` reference.
  const [fetchedOptions, setFetchedOptions] = useState<SelectOption[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!jsonPath || !tenantSlug) {
      setFetchedOptions(null)
      return
    }

    let active = true
    const fetchOptions = async () => {
      setLoading(true)
      try {
        const response = await fetch(jsonPath)
        if (response.ok) {
          const data = await response.json()
          if (active) setFetchedOptions(normalizeSelectOptions(data))
        } else if (active) {
          setFetchedOptions(null)
        }
      } catch (error) {
        console.error("Error fetching options:", error)
        if (active) setFetchedOptions(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchOptions()
    return () => { active = false }
  }, [jsonPath, tenantSlug])

  const safeOptions = fetchedOptions ?? staticOptions

  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Select value={value || ""} onValueChange={onChange} disabled={loading}>
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
          {safeOptions.length === 0 ? (
            <SelectItem value="no-options" disabled>
              No options available
            </SelectItem>
          ) : (
            safeOptions.map((option, index) => {
              const optLabel = option.label
              const optValue = option.value || `opt-${index}`
              const optKey = `opt-${index}-${optValue}`
              
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

