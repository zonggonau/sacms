"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

import { Button } from "@/components/ui/button"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { FIELD_TYPES } from "@/lib/field-types"
import { RelationFieldConfig, ComponentFieldConfig } from "@/components/content/relation-field-config"

export interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: any
  relationType: string
  targetModel: string
  targetSlug: string
  componentSlug: string
  repeatable: boolean
  autoGenerate?: boolean
  sourceField?: string
}

interface FieldConfigModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  editingField: Field | null
  setEditingField: React.Dispatch<React.SetStateAction<Field | null>>
  fields: Field[]
  tenantSlug: string
  context: "contentType" | "singleType" | "component"
  onSave: () => void
}

export function FieldConfigModal({
  isOpen,
  onOpenChange,
  editingField,
  setEditingField,
  fields,
  tenantSlug,
  context,
  onSave
}: FieldConfigModalProps) {
  
  const generateFieldSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  }

  const fieldTypeInfo = editingField ? FIELD_TYPES.find(ft => ft.type === editingField.type) : null
  const Icon = fieldTypeInfo?.icon

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] rounded-none border border-slate-200 shadow-none overflow-hidden p-0 flex flex-col bg-[#f6f6f9]">
        <DialogHeader className="p-6 bg-white border-b border-slate-200 shrink-0 flex flex-row items-center gap-4">
          <div className="w-10 h-10 rounded-none bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shrink-0">
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 text-left">
              Configure {fieldTypeInfo?.label || "Field"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-xs text-left mt-0.5">
              Define rules and identity for this attribute.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto max-h-[60vh] min-h-[30vh] bg-white">
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Field Name *</Label>
                <Input 
                  value={editingField?.name || ""} 
                  onChange={e => {
                    const slug = generateFieldSlug(e.target.value)
                    setEditingField(prev => prev ? ({ ...prev, name: e.target.value, slug }) : null)
                  }}
                  placeholder="e.g., Hero Title"
                  className="bg-white border border-slate-200 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-11 rounded-none text-sm font-medium shadow-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">API Slug *</Label>
                <Input 
                  value={editingField?.slug || ""} 
                  onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)}
                  placeholder="hero_title"
                  className="bg-white border border-slate-200 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-11 rounded-none font-mono text-xs shadow-none transition-all"
                />
              </div>
            </div>

            {/* Field Specific Configs */}
            {(editingField?.type === "select" || editingField?.type === "tags") && (
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-700">Options (Comma separated)</Label>
                <Input 
                  value={editingField.options as string || ""} 
                  onChange={e => setEditingField(prev => prev ? ({ ...prev, options: e.target.value }) : null)}
                  placeholder="Option A, Option B, Option C"
                  className="bg-white border border-slate-200 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary h-11 rounded-none text-sm font-medium shadow-none transition-all"
                />
              </div>
            )}

            {editingField?.type === "relation" && tenantSlug && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-none space-y-4">
                <RelationFieldConfig
                  tenantSlug={tenantSlug}
                  context={context}
                  relationType={editingField.relationType}
                  targetModel={editingField.targetModel}
                  targetSlug={editingField.targetSlug}
                  onRelationTypeChange={(v) => setEditingField(prev => prev ? ({ ...prev, relationType: v }) : null)}
                  onTargetModelChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetModel: v, targetSlug: "" }) : null)}
                  onTargetSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetSlug: v }) : null)}
                />
              </div>
            )}

            {editingField?.type === "component" && tenantSlug && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-none">
                <ComponentFieldConfig
                  tenantSlug={tenantSlug}
                  componentSlug={editingField.componentSlug}
                  repeatable={editingField.repeatable}
                  onComponentSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, componentSlug: v }) : null)}
                  onRepeatableChange={(v) => setEditingField(prev => prev ? ({ ...prev, repeatable: v }) : null)}
                />
              </div>
            )}

            {editingField?.type === "slug" && (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-none space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="autoGenerate" 
                    checked={editingField?.autoGenerate} 
                    onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, autoGenerate: !!checked }) : null)} 
                  />
                  <Label htmlFor="autoGenerate" className="text-xs font-bold cursor-pointer text-slate-700">Auto-generate from another field</Label>
                </div>
                {editingField?.autoGenerate && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Source Field</Label>
                    <Select 
                      value={editingField.sourceField || ""} 
                      onValueChange={v => setEditingField(prev => prev ? ({ ...prev, sourceField: v }) : null)}
                    >
                      <SelectTrigger className="bg-white border border-slate-200 h-11 rounded-none text-sm font-medium shadow-none focus:ring-1 focus:ring-primary focus:border-primary">
                        <SelectValue placeholder="Select a field" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border border-slate-200 shadow-none bg-white">
                        {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).map(f => (
                          <SelectItem key={f.slug} value={f.slug} className="rounded-none text-sm font-medium cursor-pointer">
                            {f.name} ({f.slug})
                          </SelectItem>
                        ))}
                        {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).length === 0 && (
                          <div className="p-2 text-xs text-muted-foreground italic">No text fields available</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="flex items-center space-x-2.5 p-3.5 bg-slate-50 border border-slate-100 rounded-none">
                <Checkbox 
                  id="required" 
                  checked={editingField?.required || false} 
                  onCheckedChange={(checked) => setEditingField(prev => prev ? ({ ...prev, required: !!checked }) : null)}
                />
                <Label htmlFor="required" className="text-xs font-bold cursor-pointer text-slate-700">Required Field</Label>
              </div>
              <div className="flex items-center space-x-2.5 p-3.5 bg-slate-50 border border-slate-100 rounded-none">
                <Checkbox 
                  id="unique" 
                  checked={editingField?.unique || false} 
                  onCheckedChange={(checked) => setEditingField(prev => prev ? ({ ...prev, unique: !!checked }) : null)}
                />
                <Label htmlFor="unique" className="text-xs font-bold cursor-pointer text-slate-700">Unique Field</Label>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-200 gap-2 shrink-0 flex flex-row justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-none font-bold text-xs">Cancel</Button>
          <Button onClick={onSave} className="rounded-none font-bold text-xs px-6 bg-primary hover:bg-primary/90 text-white shadow-none">
            {fields.some(f => f.id === (editingField?.id || "")) ? "Update Field" : "Add Field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
