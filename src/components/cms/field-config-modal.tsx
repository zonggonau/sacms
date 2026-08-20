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
import { useParams } from "next/navigation"
import { MediaField } from "@/components/content/field-renderers/media-field"
import { toast } from "@/hooks/use-toast"
import { Loader2, FileText, CheckCircle2, X } from "lucide-react"
import { useState } from "react"

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
  templateComponents,
  templateContentTypes,
  templateSingleTypes
}: FieldConfigModalProps) {
  
  const [isUploading, setIsUploading] = useState(false)

  const generateFieldSlug = (value: string) => {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
  }

  const fieldTypeInfo = editingField ? FIELD_TYPES.find(ft => ft.type === editingField.type) : null
  const Icon = fieldTypeInfo?.icon

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg max-h-[90vh] rounded-2xl border border-border/80 shadow-xl overflow-hidden p-0 flex flex-col bg-card text-card-foreground">
        <DialogHeader className="p-5 bg-card border-b border-border/60 shrink-0 flex flex-row items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-foreground text-left">
              Konfigurasi {fieldTypeInfo?.label || "Field"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs text-left mt-0.5">
              Tentukan nama, slug, dan aturan validasi atribut ini.
            </DialogDescription>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto max-h-[60vh] min-h-[30vh] bg-background">
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
                  placeholder="Contoh: Judul Artikel"
                  className="bg-background border border-input h-9 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">API Slug *</Label>
                <Input 
                  value={editingField?.slug || ""} 
                  onChange={e => setEditingField(prev => prev ? ({ ...prev, slug: e.target.value }) : null)}
                  placeholder="judul_artikel"
                  className="bg-background border border-input h-9 rounded-xl font-mono text-xs"
                />
              </div>
            </div>

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
                  relationType={editingField.relationType}
                  targetModel={editingField.targetModel}
                  targetSlug={editingField.targetSlug}
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
                  componentSlug={editingField.componentSlug}
                  repeatable={editingField.repeatable}
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

            {editingField?.type === "document_template" && (
              <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Upload Template Dokumen (.docx)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="file"
                      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      disabled={isUploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (!file.name.endsWith(".docx")) {
                          toast({
                            title: "Format Salah",
                            description: "Hanya berkas .docx yang diperbolehkan.",
                            variant: "destructive",
                          });
                          return;
                        }

                        setIsUploading(true);
                        const formData = new FormData();
                        formData.append("file", file);

                        try {
                          const res = await fetch(`/api/tenant/${tenantSlug}/media/upload`, {
                            method: "POST",
                            body: formData,
                          });

                          if (!res.ok) throw new Error("Gagal mengunggah berkas");

                          const data = await res.json();
                          const fileUrl = data.url || data.media?.url;

                          let currentOpts: any = {};
                          if (typeof editingField.options === "string") {
                            try { currentOpts = JSON.parse(editingField.options); } catch {}
                          } else if (editingField.options) {
                            currentOpts = { ...editingField.options };
                          }

                          currentOpts.templateUrl = fileUrl;
                          currentOpts.templateName = file.name;

                          setEditingField((prev) => prev ? ({ ...prev, options: currentOpts }) : null);
                          toast({ title: "Template Berhasil Diunggah", description: `Berkas ${file.name} telah disimpan.` });
                        } catch (err: any) {
                          toast({ title: "Upload Gagal", description: err.message, variant: "destructive" });
                        } finally {
                          setIsUploading(false);
                        }
                      }}
                      className="bg-background border border-input h-9 rounded-xl text-xs"
                    />
                    {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                  </div>

                  {(() => {
                    let opts: any = {};
                    if (typeof editingField.options === "string") {
                      try { opts = JSON.parse(editingField.options); } catch {}
                    } else if (editingField.options) {
                      opts = editingField.options;
                    }
                    if (opts?.templateUrl) {
                      return (
                        <div className="flex items-center justify-between p-2.5 mt-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                              {opts.templateName || "Template Terpasang"}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive rounded-lg"
                            onClick={() => setEditingField((prev) => {
                              if (!prev) return null;
                              let newOptions = typeof prev.options === "string" ? JSON.parse(prev.options || "{}") : { ...prev.options };
                              delete newOptions.templateUrl;
                              delete newOptions.templateName;
                              return { ...prev, options: newOptions };
                            })}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
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
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border/60 gap-2 shrink-0 flex flex-row justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-semibold text-xs h-8">
            Batal
          </Button>
          <Button onClick={onSave} className="rounded-xl font-bold text-xs px-5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs">
            {fields.some(f => f.id === (editingField?.id || "")) ? "Simpan Perubahan" : "Tambahkan Field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


