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
      <DialogContent className="max-w-4xl sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0 border border-slate-200 shadow-none rounded-none bg-[#f6f6f9]">
        
        {/* Header */}
        <DialogHeader className="px-8 py-6 bg-white border-b border-slate-200 shrink-0 flex flex-row items-center justify-between">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-lg font-bold text-slate-800">{title}</DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">{description}</DialogDescription>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search a field..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white border border-slate-200 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary rounded-none text-sm font-medium transition-all shadow-none"
            />
          </div>
        </DialogHeader>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto max-h-[60vh] min-h-[30vh] px-8 py-6">
          {filteredCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 py-10">
              <Database className="h-10 w-10 opacity-20" />
              <p className="text-sm font-medium">No fields found matching "{search}"</p>
            </div>
          ) : (
            <div className="space-y-8 pb-4">
              {filteredCategories.map(({ category, types }) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{category}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {types.map(ft => {
                      const Icon = ft.icon
                      const colorClass = categoryColors[category] || categoryColors["Basic"]
                      
                      return (
                        <button
                          key={ft.type}
                          onClick={() => {
                            onSelect(ft.type)
                            onOpenChange(false)
                            setSearch("") 
                          }}
                          className="flex items-center gap-4 p-4 rounded-none border border-slate-200 bg-white text-left hover:border-primary hover:shadow-[3px_3px_0px_rgba(0,0,0,0.06)] hover:-translate-y-[1px] transition-all cursor-pointer group"
                        >
                          <div className={cn("w-10 h-10 rounded-none border flex items-center justify-center shrink-0 transition-colors", colorClass)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 group-hover:text-primary transition-colors">{ft.label}</p>
                            <p className="text-[10px] font-medium text-slate-400 line-clamp-1 mt-0.5">{ft.description}</p>
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
