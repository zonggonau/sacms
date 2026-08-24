"use client"

import { useState, useMemo } from "react"
import { Search, Database } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"

interface FieldTypeSelectorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: string) => void
  title?: string
  description?: string
}

const categoryColors: Record<string, string> = {
  "Basic": "bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-600 group-hover:text-white",
  "Number": "bg-emerald-50 text-emerald-600 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white",
  "Date & Time": "bg-purple-50 text-purple-600 border-purple-200 group-hover:bg-purple-600 group-hover:text-white",
  "Selection": "bg-amber-50 text-amber-600 border-amber-200 group-hover:bg-amber-600 group-hover:text-white",
  "Boolean": "bg-pink-50 text-pink-600 border-pink-200 group-hover:bg-pink-600 group-hover:text-white",
  "Validation": "bg-rose-50 text-rose-600 border-rose-200 group-hover:bg-rose-600 group-hover:text-white",
  "Media": "bg-teal-50 text-teal-600 border-teal-200 group-hover:bg-teal-600 group-hover:text-white",
  "Relations": "bg-indigo-50 text-indigo-600 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white",
  "Advanced": "bg-slate-100 text-slate-700 border-slate-300 group-hover:bg-slate-700 group-hover:text-white",
}

export function FieldTypeSelector({
  isOpen,
  onOpenChange,
  onSelect,
  title = "Select a field for your collection type",
  description = "Choose the type of attribute you want to add."
}: FieldTypeSelectorProps) {
  const [search, setSearch] = useState("")

  const filteredCategories = useMemo(() => {
    const s = search.toLowerCase()
    return FIELD_CATEGORIES.map(category => {
      const types = FIELD_TYPES.filter(ft => 
        ft.category === category && 
        (ft.label.toLowerCase().includes(s) || 
         ft.description.toLowerCase().includes(s))
      )
      return { category, types }
    }).filter(c => c.types.length > 0)
  }, [search])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 border border-border/80 shadow-lg rounded-2xl bg-card text-foreground">
        
        {/* Header */}
        <DialogHeader className="px-6 py-4.5 bg-card border-b border-border/60 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 pr-12">
          <div className="flex flex-col gap-0.5 min-w-0">
            <DialogTitle className="text-base font-bold text-foreground truncate">{title}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
          </div>
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Cari tipe field..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 h-8.5 bg-muted/40 border-border/80 rounded-xl text-xs focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </DialogHeader>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] min-h-[30vh] px-6 py-5 bg-muted/20">
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
              <Database className="h-8 w-8 opacity-20" />
              <p className="text-xs font-semibold">Tipe field "{search}" tidak ditemukan</p>
            </div>
          ) : (
            <div className="space-y-6 pb-2">
              {filteredCategories.map(({ category, types }) => (
                <div key={category} className="space-y-2.5">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {types.map(ft => {
                      const Icon = ft.icon
                      
                      return (
                        <button
                          key={ft.type}
                          onClick={() => {
                            onSelect(ft.type)
                            onOpenChange(false)
                            setSearch("") 
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl border border-border/70 bg-card text-left hover:border-primary hover:bg-muted/40 transition-all cursor-pointer group shadow-xs"
                        >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{ft.label}</p>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{ft.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}


