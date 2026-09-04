"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
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
import { DocxTemplateWizard } from "@/components/cms/docx-template-wizard"
import { toast } from "@/hooks/use-toast"
import { Loader2, FileText, CheckCircle2, X, Sparkles, Eye, EyeOff } from "lucide-react"
import { useState } from "react"

export interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: any
  showInCms?: boolean
  relationType?: string
  targetModel?: string
  targetSlug?: string
  relationSlug?: string
  componentSlug?: string
  repeatable?: boolean
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
  onSaveBatch?: (newFields: Field[]) => void
  templateComponents?: any[]
  templateContentTypes?: any[]
  templateSingleTypes?: any[]
}

export function FieldConfigModal({
  isOpen,
  onOpenChange,
  editingField,
  setEditingField,
  fields,
  tenantSlug,
  context,
  onSave,
  onSaveBatch,
  templateComponents,
  templateContentTypes,
  templateSingleTypes
}: FieldConfigModalProps) {
  
  const generateFieldSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  }

  const fieldTypeInfo = editingField ? FIELD_TYPES.find(ft => ft.type === editingField.type) : null
  const Icon = fieldTypeInfo?.icon

  const isDocxTemplate = editingField?.type === "document_template"

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg sm:max-w-lg ${isDocxTemplate ? 'sm:max-w-3xl' : ''} max-h-[92vh] rounded-2xl border border-border/80 shadow-2xl overflow-hidden p-0 flex flex-col bg-card text-card-foreground`}>
        <DialogHeader className="p-5 pr-12 bg-card border-b border-border/60 shrink-0 flex flex-row items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground text-left flex items-center gap-2">
              <span>Konfigurasi {fieldTypeInfo?.label || "Field"}</span>
              {isDocxTemplate && (
                <span className="text-[10px] font-bold py-0.5 px-2 bg-primary/10 text-primary rounded-full">
                  Smart Auto-Generator
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs text-left mt-0.5">
              {isDocxTemplate 
                ? "Unggah berkas Word (.docx). Sistem akan mendeteksi variabel placeholder dan membuat field secara otomatis."
                : "Tentukan nama, slug, dan aturan validasi atribut ini."}
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className={`flex-1 overflow-y-auto ${isDocxTemplate ? 'max-h-[76vh]' : 'max-h-[65vh]'} min-h-[30vh] bg-background`}>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Nama Field *</Label>
                <Input 
                  value={editingField?.name || ""} 
                  onChange={e => {
                    const slug = generateFieldSlug(e.target.value)
                    setEditingField(prev => prev ? ({ ...prev, name: e.target.value, slug }) : null)
                  }}
                  placeholder="Contoh: Format Surat"
                  className="bg-background border border-input h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">API Slug *</Label>
                <Input 
                  value={editingField?.slug || ""} 
                  onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)}
                  placeholder="format_surat"
                  className="bg-background border border-input h-9 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

            {/* Smart DOCX Template Wizard Integration */}
            {isDocxTemplate && (
              <DocxTemplateWizard
                tenantSlug={tenantSlug}
                existingFields={fields}
                availableContentTypes={templateContentTypes || []}
                onApply={(generatedFields, templateOptions) => {
                  if (!editingField) return
                  const mainTemplateField: Field = {
                    ...editingField,
                    name: editingField.name || "Format Surat",
                    slug: editingField.slug || "format_surat",
                    type: "document_template",
                    options: templateOptions,
                  }

                  if (onSaveBatch) {
                    onSaveBatch([mainTemplateField, ...generatedFields])
                  } else {
                    setEditingField(mainTemplateField)
                    onSave()
                  }

                  toast({
                    title: "Field & Skema Berhasil Dibuat",
                    description: `Template dan ${generatedFields.length} field pendukung telah ditambahkan.`,
                  })
                  onOpenChange(false)
                }}
                onCancel={() => onOpenChange(false)}
              />
            )}

            {/* Field Specific Configs */}
            {(editingField?.type === "select" || editingField?.type === "multiselect" || editingField?.type === "tags") && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Opsi Pilihan (Pisahkan dengan koma)</Label>
                <Input 
                  value={typeof editingField.options === 'string' ? editingField.options : (editingField.options?.choices?.join(', ') || (Array.isArray(editingField.options) ? editingField.options.join(', ') : ''))} 
                  onChange={e => setEditingField(prev => prev ? ({ ...prev, options: e.target.value }) : null)}
                  placeholder="Opsi A, Opsi B, Opsi C"
                  className="bg-background border border-input h-9 rounded-xl text-xs"
                />
              </div>
            )}

            {editingField?.type === "relation" && tenantSlug && (
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-3">
                <RelationFieldConfig
                  tenantSlug={tenantSlug}
                  context={context}
                  relationType={editingField.relationType || "manyToOne"}
                  targetModel={editingField.targetModel || "content-type"}
                  targetSlug={editingField.targetSlug || ""}
                  onRelationTypeChange={(v) => setEditingField(prev => prev ? ({ ...prev, relationType: v }) : null)}
                  onTargetModelChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetModel: v, targetSlug: "" }) : null)}
                  onTargetSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, targetSlug: v }) : null)}
                  customContentTypes={templateContentTypes}
                  customSingleTypes={templateSingleTypes}
                />
              </div>
            )}

            {editingField?.type === "component" && tenantSlug && (
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl">
                <ComponentFieldConfig
                  tenantSlug={tenantSlug}
                  componentSlug={editingField.componentSlug || ""}
                  repeatable={editingField.repeatable || false}
                  onComponentSlugChange={(v) => setEditingField(prev => prev ? ({ ...prev, componentSlug: v }) : null)}
                  onRepeatableChange={(v) => setEditingField(prev => prev ? ({ ...prev, repeatable: v }) : null)}
                  customComponents={templateComponents}
                />
              </div>
            )}

            {editingField?.type === "slug" && (
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-3">
                <div className="flex items-center space-x-2.5">
                  <Checkbox 
                    id="autoGenerate" 
                    checked={editingField?.autoGenerate} 
                    onCheckedChange={checked => setEditingField(prev => prev ? ({ ...prev, autoGenerate: !!checked }) : null)} 
                  />
                  <Label htmlFor="autoGenerate" className="text-xs font-semibold cursor-pointer text-foreground">Otomatis generate dari field lain</Label>
                </div>
                {editingField?.autoGenerate && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Sumber Field</Label>
                    <Select 
                      value={editingField.sourceField || ""} 
                      onValueChange={v => setEditingField(prev => prev ? ({ ...prev, sourceField: v }) : null)}
                    >
                      <SelectTrigger className="bg-background border border-input h-9 rounded-xl text-xs">
                        <SelectValue placeholder="Pilih field sumber" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border border-border bg-card">
                        {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).map(f => (
                          <SelectItem key={f.slug} value={f.slug} className="rounded-lg text-xs cursor-pointer">
                            {f.name} ({f.slug})
                          </SelectItem>
                        ))}
                        {fields.filter(f => f.id !== editingField.id && (f.type === "text" || f.type === "textarea")).length === 0 && (
                          <div className="p-2 text-xs text-muted-foreground italic">Tidak ada field teks yang tersedia</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {!isDocxTemplate && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between p-3.5 bg-muted/30 border border-border/60 rounded-xl">
                  <div className="space-y-0.5 pr-2">
                    <Label htmlFor="showInCms" className="text-xs font-bold cursor-pointer text-foreground flex items-center gap-1.5">
                      {(editingField?.showInCms ?? editingField?.options?.showInCms ?? true) ? (
                        <Eye className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span>Tampilkan di CMS Studio</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Aktifkan agar field ini tampil pada form input data dan tabel entri di CMS Studio.
                    </p>
                  </div>
                  <Switch
                    id="showInCms"
                    checked={editingField?.showInCms ?? editingField?.options?.showInCms ?? true}
                    onCheckedChange={(checked) => setEditingField(prev => {
                      if (!prev) return null
                      let currentOpts = typeof prev.options === 'object' && prev.options !== null ? { ...prev.options } : {}
                      currentOpts.showInCms = checked
                      return { ...prev, showInCms: checked, options: currentOpts }
                    })}
                  />
                </div>

                {/* Conditional Visibility — show this field in the entry form
                    only when another field matches a value. Scoped to a
                    single condition (targetField op value); other fields on
                    this content type that support a plain scalar comparison
                    are offered as the target. */}
                {(() => {
                  const opts = typeof editingField?.options === 'object' && editingField?.options !== null ? editingField.options : {}
                  const showIf = opts.showIf as { targetFieldSlug?: string; operator?: "equals" | "notEquals"; value?: string } | undefined
                  const candidateFields = fields.filter(f => f.id !== editingField?.id && ["text", "select", "boolean", "number"].includes(f.type))

                  const updateShowIf = (patch: Partial<NonNullable<typeof showIf>> | null) => {
                    setEditingField(prev => {
                      if (!prev) return null
                      const currentOpts = typeof prev.options === 'object' && prev.options !== null ? { ...prev.options } : {}
                      if (patch === null) {
                        const { showIf: _drop, ...rest } = currentOpts
                        return { ...prev, options: rest }
                      }
                      const nextShowIf = { operator: "equals", ...(currentOpts.showIf || {}), ...patch }
                      return { ...prev, options: { ...currentOpts, showIf: nextShowIf } }
                    })
                  }

                  return (
                    <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2.5">
                        <Checkbox
                          id="conditionalVisibility"
                          checked={!!showIf?.targetFieldSlug}
                          disabled={candidateFields.length === 0}
                          onCheckedChange={(checked) => updateShowIf(checked ? { targetFieldSlug: candidateFields[0]?.slug || "" } : null)}
                        />
                        <Label htmlFor="conditionalVisibility" className="text-xs font-semibold cursor-pointer text-foreground">
                          Tampilkan Bersyarat (Conditional Visibility)
                        </Label>
                      </div>
                      {candidateFields.length === 0 && (
                        <p className="text-[11px] text-muted-foreground pl-6">
                          Tambahkan field teks, pilihan, angka, atau boolean lain terlebih dahulu untuk dijadikan syarat.
                        </p>
                      )}
                      {showIf?.targetFieldSlug && (
                        <div className="grid grid-cols-3 gap-2 pl-6">
                          <Select value={showIf.targetFieldSlug} onValueChange={(v) => updateShowIf({ targetFieldSlug: v })}>
                            <SelectTrigger className="bg-background border border-input h-9 rounded-xl text-xs col-span-1">
                              <SelectValue placeholder="Field" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border bg-card">
                              {candidateFields.map(f => (
                                <SelectItem key={f.slug} value={f.slug} className="rounded-lg text-xs cursor-pointer">{f.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select value={showIf.operator || "equals"} onValueChange={(v) => updateShowIf({ operator: v as "equals" | "notEquals" })}>
                            <SelectTrigger className="bg-background border border-input h-9 rounded-xl text-xs col-span-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border bg-card">
                              <SelectItem value="equals" className="rounded-lg text-xs cursor-pointer">sama dengan</SelectItem>
                              <SelectItem value="notEquals" className="rounded-lg text-xs cursor-pointer">tidak sama dengan</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={showIf.value ?? ""}
                            onChange={(e) => updateShowIf({ value: e.target.value })}
                            placeholder="Nilai"
                            className="bg-background border border-input h-9 rounded-xl text-xs col-span-1"
                          />
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2.5 p-3 bg-muted/30 border border-border/60 rounded-xl">
                    <Checkbox 
                      id="required" 
                      checked={editingField?.required || false} 
                      onCheckedChange={(checked) => setEditingField(prev => prev ? ({ ...prev, required: !!checked }) : null)}
                    />
                    <Label htmlFor="required" className="text-xs font-semibold cursor-pointer text-foreground">Wajib Diisi (Required)</Label>
                  </div>
                  <div className="flex items-center space-x-2.5 p-3 bg-muted/30 border border-border/60 rounded-xl">
                    <Checkbox 
                      id="unique" 
                      checked={editingField?.unique || false} 
                      onCheckedChange={(checked) => setEditingField(prev => prev ? ({ ...prev, unique: !!checked }) : null)}
                    />
                    <Label htmlFor="unique" className="text-xs font-semibold cursor-pointer text-foreground">Nilai Unik (Unique)</Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {!isDocxTemplate && (
          <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 gap-2 shrink-0 flex flex-row justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-xs h-8">
              Batal
            </Button>
            <Button onClick={onSave} className="rounded-xl font-bold text-xs px-5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
              {fields.some(f => f.id === (editingField?.id || "")) ? "Simpan Perubahan" : "Tambahkan Field"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
