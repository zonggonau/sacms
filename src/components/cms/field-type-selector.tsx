"use client"

import { useState } from "react"
import { Plus, Search } from "lucide-react"
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FIELD_TYPES, FIELD_CATEGORIES } from "@/lib/field-types"

interface FieldTypeSelectorProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (type: string) => void
  title?: string
  description?: string
}

export function FieldTypeSelector({
  isOpen,
  onOpenChange,
  onSelect,
  title = "Select Attribute Type",
  description = "Choose the type of data this field will hold."
}: FieldTypeSelectorProps) {
  const [search, setSearch] = useState("")

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl">
        <DialogHeader className="p-8 bg-muted/10 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">{title}</DialogTitle>
              <DialogDescription className="text-xs">{description}</DialogDescription>
            </div>
          </div>
          <div className="relative mt-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search types..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-card border-none rounded-xl font-medium"
            />
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-8 space-y-10">
            {FIELD_CATEGORIES.map(category => {
              const categoryTypes = FIELD_TYPES.filter(ft => 
                ft.category === category && 
                (ft.label.toLowerCase().includes(search.toLowerCase()) || 
                 ft.description.toLowerCase().includes(search.toLowerCase()))
              )
              if (categoryTypes.length === 0) return null
              
              return (
                <div key={category} className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">{category}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {categoryTypes.map(ft => {
                      const Icon = ft.icon
                      return (
                        <button
                          key={ft.type}
                          onClick={() => {
                            onSelect(ft.type)
                            onOpenChange(false)
                            setSearch("") // Reset search on select
                          }}
                          className="flex items-start gap-4 p-4 rounded-2xl border bg-card text-left hover:border-primary hover:ring-4 hover:ring-primary/5 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{ft.label}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">{ft.description}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
