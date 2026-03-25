"use client"

import { useState, useEffect } from "react"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface Entry {
  id: string
  data: any
}

interface RelationSelectFieldProps {
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  tenantSlug: string
  targetSlug: string
  label: string
  required?: boolean
  multiple?: boolean
  placeholder?: string
}

export function RelationSelectField({
  value,
  onChange,
  tenantSlug,
  targetSlug,
  label,
  required,
  multiple = false,
  placeholder,
}: RelationSelectFieldProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchEntries() {
      if (!targetSlug || !tenantSlug) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${targetSlug}/entries?page=1&pageSize=100`)
        if (!res.ok) throw new Error("Failed to load related data")
        const data = await res.json()
        
        // Parse data if it's stringified JSON
        const parsedEntries = (data.entries || []).map((e: any) => ({
          ...e,
          data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        }))
        
        setEntries(parsedEntries)
      } catch (err: any) {
        console.error("Relation fetch error:", err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchEntries()
  }, [tenantSlug, targetSlug])

  // Helper to get display label from entry data
  const getEntryLabel = (entry: Entry) => {
    const d = entry.data || {}
    
    // Priority list for labels
    const labelCandidates = [
      d.name, d.nama, d.label, 
      d.title, d.judul, d.subject, d.subjek,
      d.fullName, d.namaLengkap,
      d.slug, // Use slug as a lower priority if name is not found
      entry.id.substring(0, 8) // Final fallback
    ]

    return labelCandidates.find(val => val && typeof val === 'string' && val.trim() !== "") || entry.id.substring(0, 8)
  }

  if (!targetSlug) {
    return (
      <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
        <AlertCircle className="h-4 w-4" />
        Missing target configuration for relation.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <Select
        value={(value as string) || ""}
        onValueChange={(val) => {
          if (multiple) {
            // For now, standard Radix Select doesn't support multiple easily
            // We'll treat it as single for now or implement a custom tag-based multi-select later
            onChange([val])
          } else {
            onChange(val)
          }
        }}
        disabled={loading || entries.length === 0}
      >
        <SelectTrigger className="w-full bg-muted/30 border-none h-11 rounded-xl font-bold">
          <SelectValue placeholder={placeholder || `Select ${label}...`} />
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {entries.length === 0 && !loading ? (
            <SelectItem value="_none" disabled>No {label} available</SelectItem>
          ) : (
            entries.map((entry) => (
              <SelectItem key={entry.id} value={entry.id} className="font-bold">
                {getEntryLabel(entry)}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
      <p className="text-[10px] text-muted-foreground italic">Relating to: <span className="font-mono">{targetSlug}</span></p>
    </div>
  )
}
