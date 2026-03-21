"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Loader2, Link2, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"

interface RelationJsonFieldProps {
  value: any
  onChange: (value: any) => void
  tenantSlug: string
  targetSlug: string
  label: string
}

export function RelationJsonField({ value, onChange, tenantSlug, targetSlug, label }: RelationJsonFieldProps) {
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [showPicker, setShowPicker] = useState(false)

  const fetchEntries = async () => {
    if (!targetSlug) return
    setLoading(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${targetSlug}/entries`)
      if (response.ok) {
        const data = await response.json()
        // API returns { entries: [], meta: ... }
        setEntries(data.entries || [])
      }
    } catch (error) {
      console.error("Failed to fetch entries:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showPicker) fetchEntries()
  }, [showPicker, targetSlug])

  const handleSelect = (entry: any) => {
    // We store the entry data as JSON as requested
    onChange(entry.data)
    setShowPicker(false)
  }

  const filteredEntries = Array.isArray(entries) ? entries.filter(e => {
    const title = e.data?.title || e.data?.name || e.data?.judul || "Untitled"
    return title.toLowerCase().includes(search.toLowerCase())
  }) : []

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold">{label}</Label>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-[10px] font-bold"
          onClick={() => setShowPicker(!showPicker)}
        >
          <Link2 className="h-3 w-3 mr-1" />
          {value ? "Change Relation" : "Select Relation"}
        </Button>
      </div>

      {showPicker && (
        <div className="border rounded-xl bg-muted/20 p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search entries..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
          <ScrollArea className="h-48">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : filteredEntries.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground italic">No entries found</div>
            ) : (
              <div className="space-y-1">
                {filteredEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => handleSelect(entry)}
                    className="w-full text-left p-2 rounded-lg hover:bg-primary/5 hover:text-primary transition-colors text-xs font-medium border border-transparent hover:border-primary/20"
                  >
                    {entry.data?.title || entry.data?.name || entry.data?.judul || entry.id}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      <div className="relative">
        <Textarea
          value={value ? (typeof value === 'string' ? value : JSON.stringify(value, null, 2)) : ""}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              onChange(e.target.value)
            }
          }}
          placeholder="Relation data (JSON)"
          className="font-mono text-[10px] min-h-[120px] bg-muted/10 border-dashed"
        />
        {value && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-[8px] font-black uppercase opacity-50">Stored as JSON</Badge>
          </div>
        )}
      </div>
    </div>
  )
}
