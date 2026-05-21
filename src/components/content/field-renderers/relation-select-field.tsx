"use client"

import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { 
  Check, 
  ChevronsUpDown, 
  X, 
  Loader2, 
  AlertCircle,
  Search,
  Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"

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
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Normalize value to array for easier internal handling if multiple
  const selectedIds = Array.isArray(value) ? value : value ? [value] : []

  const fetchEntries = useCallback(async (search: string = "") => {
    if (!targetSlug || !tenantSlug) return
    setLoading(true)
    setError(null)
    try {
      const url = `/api/tenant/${tenantSlug}/content-types/slug/${targetSlug}/entries?page=1&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to load related data")
      const data = await res.json()
      
      const parsedEntries = (data.data || data.entries || []).map((e: any) => ({
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
  }, [tenantSlug, targetSlug])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const getEntryLabel = (entry: Entry | undefined) => {
    if (!entry) return "Unknown"
    const d = entry.data || {}
    const labelCandidates = [
      d.name, d.nama, d.title, d.judul, d.subject, 
      d.fullName, d.namaLengkap, d.label, d.slug
    ]
    return labelCandidates.find(val => val && typeof val === 'string' && val.trim() !== "") || entry.id.substring(0, 8)
  }

  const handleSelect = (id: string) => {
    if (multiple) {
      const newSelection = selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id]
      onChange(newSelection)
    } else {
      onChange(id)
      setOpen(false)
    }
  }

  const removeSelected = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (multiple) {
      onChange(selectedIds.filter((i) => i !== id))
    } else {
      onChange("")
    }
  }

  if (!targetSlug) {
    return (
      <div className="p-3 bg-red-50 border border-red-100 rounded-none flex items-center gap-2 text-red-600 text-[10px] font-black uppercase tracking-tighter">
        <AlertCircle className="h-4 w-4" /> Missing target configuration.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-700">
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      </div>

      <div className="space-y-2">
        {/* Selected Items Tags */}
        {multiple && selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2.5 bg-muted/20 rounded-none border border-dashed border-muted">
            {selectedIds.map((id) => {
              const entry = entries.find((e) => e.id === id)
              return (
                <Badge 
                  key={id} 
                  variant="secondary" 
                  className="rounded-none py-1 pl-3 pr-1.5 flex items-center gap-1.5 bg-card border shadow-none"
                >
                  <span className="text-[11px] font-bold text-slate-800">{entry ? getEntryLabel(entry) : id.substring(0, 8)}</span>
                  <button 
                    onClick={(e) => removeSelected(id, e)}
                    className="h-4 w-4 rounded-none hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )
            })}
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-full justify-between bg-muted/30 border-none h-11 rounded-none font-bold px-4 hover:bg-muted/40 transition-all",
                !multiple && selectedIds.length > 0 && "text-slate-900",
                selectedIds.length === 0 && "text-muted-foreground font-normal"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {!multiple && selectedIds.length > 0 ? (
                   <span className="truncate">{getEntryLabel(entries.find(e => e.id === selectedIds[0]))}</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Search className="h-4 w-4 opacity-50" />
                    {placeholder || `Search ${label}...`}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0 border border-border bg-popover shadow-none rounded-none overflow-hidden" align="start">
            <Command className="rounded-none border-none">
              <CommandInput 
                placeholder={`Search ${targetSlug}...`} 
                onValueChange={(val) => {
                  setSearchTerm(val)
                  // Optional: Fetch on type if data is large
                }}
                className="h-12 border-none font-bold"
              />
              <CommandList className="max-h-[300px]">
                <CommandEmpty className="p-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">No entries found for "{searchTerm}"</p>
                  </div>
                </CommandEmpty>
                <CommandGroup className="p-2">
                  {entries.map((entry) => (
                    <CommandItem
                      key={entry.id}
                      value={entry.id}
                      onSelect={() => handleSelect(entry.id)}
                      className="rounded-none p-3 font-bold cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className={cn(
                          "h-5 w-5 rounded-none border-2 flex items-center justify-center transition-all",
                          selectedIds.includes(entry.id) 
                            ? "bg-primary border-primary" 
                            : "border-muted-foreground/20 bg-transparent"
                        )}>
                          <Check className={cn(
                            "h-3.5 w-3.5 text-white transition-opacity",
                            selectedIds.includes(entry.id) ? "opacity-100" : "opacity-0"
                          )} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm">{getEntryLabel(entry)}</span>
                          <span className="text-[10px] font-normal text-muted-foreground opacity-60 font-mono">{entry.id}</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
              <div className="p-3 border-t bg-muted/5 flex justify-between items-center">
                 <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                   Relating to {targetSlug}
                 </p>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-7 text-[10px] uppercase font-black px-3 rounded-none"
                   onClick={() => fetchEntries(searchTerm)}
                 >
                   Refresh
                 </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded-none flex items-center gap-2">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}
