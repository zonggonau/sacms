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

import { TextField } from "./text-field"
import { TextareaField } from "./textarea-field"
import { NumberField } from "./number-field"
import { DateTimeField } from "./datetime-field"
import { BooleanField } from "./boolean-field"
import { DateField } from "./date-field"
import { SelectField } from "./select-field"
import { MediaField } from "./media-field"
import { RichTextField } from "./rich-text-field"
import { RelationSelectField } from "./relation-select-field"
import { AdvancedField } from "./advanced-fields"

interface FieldDefinition {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  options?: any
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
  value: any 
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
}: ComponentFieldProps) {
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

  const renderInnerField = (field: FieldDefinition, data: any, index: number | null) => {
    const fieldValue = data?.[field.slug]
    const onFieldChange = (val: any) => handleFieldChange(index, field.slug, val)

    let selectOptions: string[] = []
    if (field.options) {
      const opts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
      if (Array.isArray(opts)) selectOptions = opts
      else if (typeof opts === 'string') selectOptions = opts.split(",").map(o => o.trim())
    }

    switch (field.type) {
      case "text": 
        return <TextField value={fieldValue as string} onChange={onFieldChange} required={field.required} placeholder={field.name} />
      case "textarea": 
        return <TextareaField value={fieldValue as string} onChange={onFieldChange} required={field.required} />
      case "richText": 
        return <RichTextField value={fieldValue as string} onChange={onFieldChange} required={field.required} />
      case "markdown": 
        return <TextareaField value={fieldValue as string} onChange={onFieldChange} required={field.required} placeholder="Enter markdown..." />
      case "number": 
      case "integer":
      case "decimal":
      case "float":
        return <NumberField value={fieldValue as any} onChange={onFieldChange} required={field.required} type={field.type as any} />
      case "boolean": 
        return <BooleanField value={fieldValue as boolean} onChange={onFieldChange} required={field.required} />
      case "date": 
        return <DateField value={fieldValue as string} onChange={onFieldChange} required={field.required} />
      case "datetime": 
      case "timestamp":
        return <DateTimeField value={fieldValue as string} onChange={onFieldChange} required={field.required} type={field.type as any} />
      case "select": 
        return <SelectField value={fieldValue as string} onChange={onFieldChange} options={selectOptions} required={field.required} />
      case "relation":
        const relOpts = typeof field.options === 'string' ? JSON.parse(field.options) : field.options
        const isMultiple = relOpts?.relationType === 'oneToMany' || relOpts?.relationType === 'manyToMany'
        return (
          <RelationSelectField 
            value={fieldValue as any} 
            onChange={onFieldChange} 
            tenantSlug={tenantSlug}
            targetSlug={(field as any).relationSlug || relOpts?.targetSlug || ""}
            label={field.name}
            required={field.required}
            multiple={isMultiple}
          />
        )
      case "media": 
        return <MediaField value={fieldValue as string} onChange={onFieldChange} tenantSlug={tenantSlug} type="image" />
      case "file":
        return <MediaField value={fieldValue as string} onChange={onFieldChange} tenantSlug={tenantSlug} type="file" />
      case "json":
      case "color":
      case "location":
        return <AdvancedField value={fieldValue} onChange={onFieldChange} type={field.type} required={field.required} />
      default: 
        return <Input value={fieldValue as string || ""} onChange={e => onFieldChange(e.target.value)} />
    }
  }

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading component structure...</div>
  if (!definition) return <div className="text-xs text-destructive">Error: Component "{componentSlug}" not found.</div>

  const renderInnerFields = (data: any, index: number | null = null) => {
    return (
      <div className="space-y-6 py-2">
        {definition.fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/60">
              {field.name} {field.required && <span className="text-destructive">*</span>}
            </Label>
            {renderInnerField(field, data, index)}
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

      <div className="bg-muted/30 rounded-none p-4 border border-dashed border-muted-foreground/20">
        {!repeatable ? (
          renderInnerFields(value)
        ) : (
          <div className="space-y-3">
            {(Array.isArray(value) ? value : []).map((item, idx) => (
              <Card key={idx} className="border-none shadow-none overflow-hidden bg-card">
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
              className="w-full border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 text-muted-foreground hover:text-primary transition-all rounded-none h-10"
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
