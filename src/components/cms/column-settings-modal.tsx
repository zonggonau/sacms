"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Columns,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  Layers,
  Link2,
  Sparkles,
  Check,
} from "lucide-react"

export interface ColumnDefinition {
  key: string
  label: string
  group: "primary" | "relation" | "system"
  groupLabel?: string
  type?: string
  relationSlug?: string
  subField?: string
}

interface ColumnSettingsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contentType: any
  relatedSchemas?: Record<string, { name: string; slug: string; fields: any[] }>
  visibleColumns: string[]
  onChangeVisibleColumns: (columns: string[]) => void
  onResetDefault: () => void
}

export function ColumnSettingsModal({
  isOpen,
  onOpenChange,
  contentType,
  relatedSchemas = {},
  visibleColumns,
  onChangeVisibleColumns,
  onResetDefault,
}: ColumnSettingsModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedKeys, setSelectedKeys] = useState<string[]>(visibleColumns)

  // Sync selected keys when modal opens or visibleColumns prop changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedKeys(visibleColumns)
      setSearchTerm("")
    }
  }, [isOpen, visibleColumns])

  // Build full list of available columns (Primary Fields + Extra Relation Details)
  const allColumns = useMemo<ColumnDefinition[]>(() => {
    const list: ColumnDefinition[] = []
    const primaryFields = contentType?.fields || []
    const mainGroupLabel = `Kolom Tabel Utama (${contentType?.name || "Utama"})`

    // 1. All Fields from the main model
    for (const f of primaryFields) {
      list.push({
        key: f.slug,
        label: f.name,
        group: "primary",
        groupLabel: mainGroupLabel,
        type: f.type,
        relationSlug: f.relationSlug || f.options?.targetSlug,
      })
    }

    // 2. Extra Sub-fields from Related Models
    for (const f of primaryFields) {
      const fieldType = (f.type || "").toLowerCase()
      if (fieldType === "relation" || f.relationSlug) {
        const targetSlug = f.relationSlug || f.options?.targetSlug
        const targetSchema = targetSlug ? relatedSchemas[targetSlug] : null
        if (targetSchema && targetSchema.fields?.length > 0) {
          const relGroupLabel = `Detail Relasi: ${f.name} (${targetSchema.name})`
          for (const rf of targetSchema.fields) {
            list.push({
              key: `${f.slug}.${rf.slug}`,
              label: `${f.name} ➔ ${rf.name}`,
              group: "relation",
              groupLabel: relGroupLabel,
              type: rf.type,
              relationSlug: targetSlug,
              subField: rf.slug,
            })
          }
        }
      }
    }

    return list
  }, [contentType, relatedSchemas])

  // Filtered by search
  const filteredColumns = useMemo(() => {
    if (!searchTerm.trim()) return allColumns
    const q = searchTerm.toLowerCase()
    return allColumns.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q) ||
        (c.groupLabel && c.groupLabel.toLowerCase().includes(q))
    )
  }, [allColumns, searchTerm])

  // Group columns for structured display
  const groupedColumns = useMemo(() => {
    const groups: Record<string, ColumnDefinition[]> = {}
    for (const col of filteredColumns) {
      const gLabel = col.groupLabel || "Kolom Utama"
      if (!groups[gLabel]) groups[gLabel] = []
      groups[gLabel].push(col)
    }
    return groups
  }, [filteredColumns])

  const handleToggle = (key: string) => {
    if (selectedKeys.includes(key)) {
      if (selectedKeys.length <= 1) return // Keep at least 1 column
      setSelectedKeys(selectedKeys.filter((k) => k !== key))
    } else {
      setSelectedKeys([...selectedKeys, key])
    }
  }

  const handleSelectAll = () => {
    const allKeys = allColumns.map((c) => c.key)
    setSelectedKeys(allKeys)
  }

  const handleDeselectAll = () => {
    // Keep first column
    if (allColumns.length > 0) {
      setSelectedKeys([allColumns[0].key])
    }
  }

  const handleApply = () => {
    onChangeVisibleColumns(selectedKeys)
    onOpenChange(false)
  }

  const handleReset = () => {
    onResetDefault()
    onOpenChange(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 rounded-2xl border-border bg-card shadow-2xl overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border/80 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Columns className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-black tracking-tight text-foreground">
                  Pengaturan Kolom Tabel
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Sesuaikan field utama dan data relasi yang ingin ditampilkan pada tabel.
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold py-1 px-2.5 rounded-lg bg-background">
              {selectedKeys.length} / {allColumns.length} Aktif
            </Badge>
          </div>

          {/* Search inside modal */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari field atau relasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl bg-background border-border/80"
            />
          </div>
        </DialogHeader>

        {/* Quick batch selectors */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-muted/40 border-b border-border/60 text-xs">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-bold px-2 rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
              onClick={handleSelectAll}
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" /> Pilih Semua
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-bold px-2 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={handleDeselectAll}
            >
              <Square className="h-3.5 w-3.5 mr-1" /> Sembunyikan Semua
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs font-bold px-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset Default
          </Button>
        </div>

        {/* Column Checkboxes List */}
        <ScrollArea className="max-h-[360px] p-5">
          {Object.keys(groupedColumns).length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Tidak ada kolom yang cocok dengan "{searchTerm}"
            </div>
          ) : (
            <div className="space-y-5">
              {Object.entries(groupedColumns).map(([groupTitle, cols]) => (
                <div key={groupTitle} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {groupTitle.startsWith("Detail Relasi:") || groupTitle.startsWith("Relasi:") ? (
                      <Link2 className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span>{groupTitle}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cols.map((col) => {
                      const isChecked = selectedKeys.includes(col.key)
                      return (
                        <div
                          key={col.key}
                          onClick={() => handleToggle(col.key)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-primary/5 border-primary/40 text-foreground font-semibold shadow-2xs"
                              : "bg-background/60 border-border/70 text-muted-foreground hover:border-border hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => handleToggle(col.key)}
                            className="rounded-md"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-xs truncate">{col.label}</span>
                            <span className="text-[10px] text-muted-foreground font-mono truncate">
                              {col.key} {col.type ? `• ${col.type}` : ""}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-between sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Preferensi kolom disimpan otomatis di peramban Anda.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
              onClick={handleApply}
            >
              <Check className="h-3.5 w-3.5" /> Terapkan Kolom
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
