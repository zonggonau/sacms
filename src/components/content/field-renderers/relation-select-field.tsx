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

import { getEntriesAction } from "@/actions/content"
import { getSingleTypeBySlugAction } from "@/actions/single-types"

interface Entry {
  id: string
  data: any
}

interface RelationSelectFieldProps {
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  tenantSlug: string
  targetSlug: string
  label?: string
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
      const result = await getEntriesAction(tenantSlug, targetSlug, { 
        page: 1, 
        pageSize: 100, 
        search 
      })
      
      if (result.error) {
        // Fallback to Single Type
        const stResult = await getSingleTypeBySlugAction(tenantSlug, targetSlug)
        if (stResult.error || !stResult.singleType) throw new Error(result.error)
        
        // Mock a single entry from the single type
        setEntries([{
          id: stResult.singleType.id,
          data: stResult.singleType.data || {}
        }])
        return
      }
      
      const parsedEntries = (result.entries || []).map((e: any) => ({
        ...e,
        data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
      }))
      
      setEntries(parsedEntries)
    } catch (err: any) {
      console.warn("Relation fetch warning:", err.message)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, targetSlug])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  /**
   * Intelligently resolves the best human-readable label from an entry's data
   */
  const getEntryLabel = (entry: Entry | undefined): string => {
    if (!entry) return "Unknown"
    let d = entry.data || {}
    if (typeof d === "string") {
      try {
        d = JSON.parse(d)
      } catch {
        return d
      }
    }

    // 1. Direct prioritized field keys (including Indonesian governance & enterprise terms)
    const priorityKeys = [
      "nama_pejabat", "namaPejabat", "pejabat",
      "nama_pegawai", "namaPegawai", "pegawai",
      "nama_lengkap", "namaLengkap", "fullName",
      "name", "nama", "title", "judul", "subject", "label",
      "nama_kategori", "namaKategori", "kategori",
      "nama_instansi", "namaInstansi", "instansi",
      "nama_dinas", "namaDinas", "dinas",
      "nama_perusahaan", "namaPerusahaan", "perusahaan",
      "nama_barang", "namaBarang", "nama_produk", "namaProduk",
      "perihal", "nomor_surat", "nomorSurat", "no_surat",
      "username", "email", "slug"
    ]

    for (const key of priorityKeys) {
      const val = d[key]
      if (typeof val === "string" && val.trim().length > 0) {
        return val.trim()
      }
    }

    // 2. Scan all keys for any key containing "nama", "name", "title", "judul", "pejabat", "label", "subject"
    const keys = Object.keys(d)
    for (const k of keys) {
      const lowerKey = k.toLowerCase()
      if (
        lowerKey.includes("nama") ||
        lowerKey.includes("name") ||
        lowerKey.includes("title") ||
        lowerKey.includes("judul") ||
        lowerKey.includes("pejabat") ||
        lowerKey.includes("label") ||
        lowerKey.includes("subject")
      ) {
        const val = d[k]
        if (typeof val === "string" && val.trim().length > 0) {
          return val.trim()
        }
      }
    }

    // 3. Fallback to any string property in entry.data (excluding internal/IDs/dates/URLs)
    for (const k of keys) {
      const lower = k.toLowerCase()
      if (["id", "tenantid", "createdat", "updatedat", "locale", "status", "documentid"].includes(lower)) continue
      const val = d[k]
      if (typeof val === "string" && val.trim().length > 0 && val.length < 120 && !val.startsWith("http") && !val.startsWith("data:")) {
        return val.trim()
      }
    }

    return entry.id.substring(0, 8)
  }

  /**
   * Intelligently resolves secondary details (e.g. Jabatan, NIP, Instansi, Email) for subtitles
   */
  const getEntrySubtitle = (entry: Entry | undefined): string => {
    if (!entry) return ""
    let d = entry.data || {}
    if (typeof d === "string") {
      try {
        d = JSON.parse(d)
      } catch {
        return ""
      }
    }

    const mainLabel = getEntryLabel(entry)

    const subtitleKeys = [
      "jabatan", "pangkat", "golongan", "nip", "nik",
      "instansi", "dinas", "unit_kerja", "organisasi",
      "email", "phone", "nomor_telepon", "telepon",
      "kategori", "kode", "kode_surat", "nomor_surat",
      "role", "deskripsi", "keterangan"
    ]

    for (const key of subtitleKeys) {
      const val = d[key]
      if (typeof val === "string" && val.trim().length > 0 && val.trim() !== mainLabel) {
        return val.trim()
      }
    }

    const keys = Object.keys(d)
    for (const k of keys) {
      const lower = k.toLowerCase()
      if (
        lower.includes("jabatan") ||
        lower.includes("nip") ||
        lower.includes("instansi") ||
        lower.includes("email") ||
        lower.includes("pangkat")
      ) {
        const val = d[k]
        if (typeof val === "string" && val.trim().length > 0 && val.trim() !== mainLabel) {
          return val.trim()
        }
      }
    }

    return ""
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
      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-semibold">
        <AlertCircle className="h-4 w-4 shrink-0" /> Target relasi belum dikonfigurasi.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(label || loading) && (
        <div className={cn("flex items-center", label ? "justify-between" : "justify-end")}>
          {label && (
            <Label className="text-xs font-bold text-foreground">
              {label} {required && <span className="text-destructive">*</span>}
            </Label>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
        </div>
      )}

      <div className="space-y-2">
        {/* Selected Items Tags (Multi-select) */}
        {multiple && selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2.5 bg-muted/20 rounded-xl border border-dashed border-border/80">
            {selectedIds.map((id) => {
              const entry = entries.find((e) => e.id === id)
              const entryName = entry ? getEntryLabel(entry) : id.substring(0, 8)
              const entrySub = entry ? getEntrySubtitle(entry) : ""

              return (
                <Badge 
                  key={id} 
                  variant="secondary" 
                  className="rounded-lg py-1 pl-3 pr-1.5 flex items-center gap-1.5 bg-card border border-border/80 shadow-xs"
                >
                  <span className="text-xs font-bold text-foreground">
                    {entryName}
                    {entrySub && <span className="text-[10px] text-muted-foreground font-normal ml-1">({entrySub})</span>}
                  </span>
                  <button 
                    type="button"
                    onClick={(e) => removeSelected(id, e)}
                    className="h-4 w-4 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-colors cursor-pointer flex items-center justify-center"
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
                "w-full justify-between bg-background border-border/80 h-10 rounded-xl font-medium px-3.5 hover:bg-muted/40 transition-all text-xs cursor-pointer",
                !multiple && selectedIds.length > 0 && "text-foreground font-bold",
                selectedIds.length === 0 && "text-muted-foreground font-normal"
              )}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                {!multiple && selectedIds.length > 0 ? (
                  (() => {
                    const selectedEntry = entries.find(e => e.id === selectedIds[0])
                    const label = selectedEntry ? getEntryLabel(selectedEntry) : (loading ? "Memuat..." : selectedIds[0].substring(0, 8))
                    const sub = selectedEntry ? getEntrySubtitle(selectedEntry) : ""
                    return (
                      <span className="truncate flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{label}</span>
                        {sub && <span className="text-[11px] text-muted-foreground font-normal">• {sub}</span>}
                      </span>
                    )
                  })()
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Search className="h-3.5 w-3.5 opacity-50" />
                    {placeholder || `Pilih ${label || targetSlug}...`}
                  </span>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0 border border-border bg-popover shadow-xl rounded-2xl overflow-hidden" align="start">
            <Command className="rounded-2xl border-none">
              <CommandInput 
                placeholder={`Cari data ${targetSlug}...`} 
                onValueChange={(val) => {
                  setSearchTerm(val)
                }}
                className="h-10 border-none text-xs"
              />
              <CommandList className="max-h-[280px]">
                <CommandEmpty className="p-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">Tidak ada entri untuk "{searchTerm}"</p>
                  </div>
                </CommandEmpty>
                <CommandGroup className="p-1.5">
                  {entries.map((entry) => {
                    const entryLabel = getEntryLabel(entry)
                    const entrySub = getEntrySubtitle(entry)
                    const isSelected = selectedIds.includes(entry.id)

                    return (
                      <CommandItem
                        key={entry.id}
                        value={`${entryLabel} ${entrySub} ${entry.id}`}
                        onSelect={() => handleSelect(entry.id)}
                        className="rounded-lg p-2.5 font-medium cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 w-full">
                          <div className={cn(
                            "h-4 w-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                            isSelected
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground/30 bg-transparent"
                          )}>
                            <Check className={cn(
                              "h-3 w-3 text-primary-foreground transition-opacity",
                              isSelected ? "opacity-100" : "opacity-0"
                            )} />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs font-bold truncate text-foreground">{entryLabel}</span>
                            {entrySub ? (
                              <span className="text-[10px] text-muted-foreground truncate font-normal mt-0.5">{entrySub}</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/60 font-mono truncate mt-0.5">{entry.id}</span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
              <div className="p-2.5 border-t border-border bg-muted/20 flex justify-between items-center">
                 <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                   Koleksi Target: <span className="font-mono">{targetSlug}</span>
                 </p>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="h-6 text-[10px] font-bold px-2 rounded-lg cursor-pointer hover:bg-muted"
                   onClick={() => fetchEntries(searchTerm)}
                 >
                   Refresh Data
                 </Button>
              </div>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <p className="text-xs text-red-500 font-medium bg-red-500/10 p-2 rounded-xl flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
