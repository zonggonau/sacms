"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface FieldDefinition {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
}

interface ComponentDefinition {
  id: string
  name: string
  slug: string
  fields: FieldDefinition[]
}

interface ComponentFieldProps {
  tenantSlug: string
  componentSlug: string
  value: any // Could be an object or an array of objects
  onChange: (val: any) => void
  label: React.ReactNode
  repeatable?: boolean
}

export function ComponentField({
  tenantSlug,
  componentSlug,
  value,
  onChange,
  label,
  repeatable = false
}) {
  const [definition, setDefinition] = useState<ComponentDefinition | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set([0]))

  useEffect(() => {
    async function fetchDefinition() {
      if (!componentSlug || componentSlug === "undefined") {
        setLoading(false)
        return
      }
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/components/slug/${componentSlug}`)
        if (res.ok) {
          const data = await res.json()
          setDefinition(data)
        }
      } catch (err) {
        console.error("Failed to fetch component definition:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchDefinition()
  }, [tenantSlug, componentSlug])

  const handleAddField = () => {
    const newItem = {}
    const newValue = Array.isArray(value) ? [...value, newItem] : [newItem]
    onChange(newValue)
    setExpandedIndices(new Set(expandedIndices).add(newValue.length - 1))
  }

  const handleRemoveField = (index: number) => {
    if (!Array.isArray(value)) return
    const newValue = [...value]
    newValue.splice(index, 1)
    onChange(newValue)
  }

  const handleFieldChange = (index: number | null, fieldName: string, fieldValue: any) => {
    if (repeatable) {
      const newValue = Array.isArray(value) ? [...value] : []
      if (!newValue[index!]) newValue[index!] = {}
      newValue[index!] = { ...newValue[index!], [fieldName]: fieldValue }
      onChange(newValue)
    } else {
      const newValue = { ...(value || {}), [fieldName]: fieldValue }
      onChange(newValue)
    }
  }

  const toggleExpand = (index: number) => {
    const next = new Set(expandedIndices)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedIndices(next)
  }

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading component structure...</div>
  if (!definition) return <div className="text-xs text-destructive">Error: Component "{componentSlug}" not found.</div>

  const renderInnerFields = (data: any, index: number | null = null) => {
    return (
      <div className="space-y-4 py-2">
        {definition.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
              {field.name} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {field.type === "textarea" ? (
              <Textarea 
                value={data?.[field.slug] || ""} 
                onChange={(e) => handleFieldChange(index, field.slug, e.target.value)}
                className="bg-background min-h-[80px]"
              />
            ) : (
              <Input 
                value={data?.[field.slug] || ""} 
                onChange={(e) => handleFieldChange(index, field.slug, e.target.value)}
                className="bg-background h-9"
              />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {typeof label === 'string' ? <Label className="text-sm font-bold">{label}</Label> : label}
        {repeatable && (
          <Badge variant="outline" className="text-[10px] font-bold uppercase bg-primary/5 text-primary border-primary/20">
            Repeatable
          </Badge>
        )}
      </div>

      <div className="bg-muted/30 rounded-2xl p-4 border border-dashed border-muted-foreground/20">
        {!repeatable ? (
          renderInnerFields(value)
        ) : (
          <div className="space-y-3">
            {(Array.isArray(value) ? value : []).map((item, idx) => (
              <Card key={idx} className="border-none shadow-sm overflow-hidden bg-card">
                <div 
                  className="flex items-center justify-between px-4 py-2 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpand(idx)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                    <span className="text-xs font-bold text-muted-foreground">
                      {definition.name} #{idx + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive hover:bg-destructive/10" 
                      onClick={(e) => { e.stopPropagation(); handleRemoveField(idx) }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      {expandedIndices.has(idx) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {expandedIndices.has(idx) && (
                  <CardContent className="pt-4 pb-6">
                    {renderInnerFields(item, idx)}
                  </CardContent>
                )}
              </Card>
            ))}
            <Button 
              variant="outline" 
              className="w-full border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 text-muted-foreground hover:text-primary transition-all rounded-xl h-10"
              onClick={handleAddField}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to {definition.name}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
