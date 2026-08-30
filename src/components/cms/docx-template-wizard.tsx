"use client"

import React, { useState, useMemo } from "react"
import { 
  FileText, Upload, Sparkles, Check, Link2, Plus, 
  Layers, Info, CheckCircle2, ChevronRight, X, AlertCircle, Loader2,
  Search, CheckSquare, Square
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { 
  extractDocxPlaceholdersFromBuffer, 
  ExtractedPlaceholder, 
  inferFieldType, 
  generateReadableName 
} from "@/lib/docx-template-parser"

export interface WizardGeneratedField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  unique: boolean
  options: any
  relationType?: string
  targetModel?: string
  targetSlug?: string
  relationSlug?: string
  componentSlug?: string
  repeatable?: boolean
}

interface DocxTemplateWizardProps {
  tenantSlug: string
  existingFields: any[]
  availableContentTypes?: any[]
  onApply: (generatedFields: WizardGeneratedField[], templateOptions: any) => void
  onCancel: () => void
}

export function DocxTemplateWizard({
  tenantSlug,
  existingFields,
  availableContentTypes = [],
  onApply,
  onCancel,
}: DocxTemplateWizardProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [templateUrl, setTemplateUrl] = useState<string>("")
  const [templateName, setTemplateName] = useState<string>("")
  const [searchPlaceholder, setSearchPlaceholder] = useState<string>("")
  
  const [placeholders, setPlaceholders] = useState<
    (ExtractedPlaceholder & { 
      enabled: boolean
      source: "local" | "relation"
      relationTargetSlug?: string
    })[]
  >([])

  const [selectedRelationSlug, setSelectedRelationSlug] = useState<string>("")
  const [createRelationField, setCreateRelationField] = useState<boolean>(true)

  // Handle file drop/selection and auto-extraction
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".docx")) {
      toast({
        title: "Format Tidak Didukung",
        description: "Silakan unggah berkas dengan format .docx (Microsoft Word).",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setTemplateFile(file)
    setTemplateName(file.name)

    try {
      // 1. Parse placeholders locally in browser immediately
      const arrayBuffer = await file.arrayBuffer()
      const extracted = extractDocxPlaceholdersFromBuffer(arrayBuffer)

      const mappedPlaceholders = extracted.map(p => {
        const isLikelyRelation = 
          p.key.includes("pejabat") || 
          p.key.includes("pegawai") || 
          p.key.includes("atasan") || 
          p.key.includes("penandatangan") || 
          p.key.includes("kategori")

        return {
          ...p,
          enabled: true,
          source: (isLikelyRelation ? "relation" : "local") as "local" | "relation",
          relationTargetSlug: isLikelyRelation ? (availableContentTypes.find(c => p.key.includes(c.slug))?.slug || "") : "",
        }
      })

      setPlaceholders(mappedPlaceholders)

      // Auto-detect target relation if any content type matches placeholder keywords
      const detectedRelation = availableContentTypes.find(c => 
        extracted.some(p => p.key.toLowerCase().includes(c.slug.toLowerCase()))
      )
      if (detectedRelation) {
        setSelectedRelationSlug(detectedRelation.slug)
      }

      // 2. Upload file to tenant media storage
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/tenant/${tenantSlug}/media`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Gagal mengunggah berkas ke storage")
      }

      const data = await res.json()
      const url = data.url || data.media?.[0]?.url || data.media?.url || data.file?.url || ""
      setTemplateUrl(url)

      toast({
        title: "Template Berhasil Di-scan",
        description: `Ditemukan ${extracted.length} variabel placeholder di dokumen ${file.name}.`,
      })
    } catch (err: any) {
      toast({
        title: "Gagal Membaca Dokumen",
        description: err.message || "Terjadi kesalahan saat memproses template .docx",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleTogglePlaceholder = (index: number) => {
    setPlaceholders(prev => prev.map((p, i) => i === index ? { ...p, enabled: !p.enabled } : p))
  }

  const handleSelectAll = () => {
    setPlaceholders(prev => prev.map(p => ({ ...p, enabled: true })))
  }

  const handleDeselectAll = () => {
    setPlaceholders(prev => prev.map(p => ({ ...p, enabled: false })))
  }

  const handleUpdateFieldType = (index: number, newType: string) => {
    setPlaceholders(prev => prev.map((p, i) => i === index ? { ...p, inferredType: newType } : p))
  }

  const handleUpdateFieldName = (index: number, newName: string) => {
    setPlaceholders(prev => prev.map((p, i) => i === index ? { ...p, name: newName } : p))
  }

  const handleUpdateSource = (index: number, source: "local" | "relation") => {
    setPlaceholders(prev => prev.map((p, i) => i === index ? { ...p, source } : p))
  }

  const filteredPlaceholders = useMemo(() => {
    if (!searchPlaceholder.trim()) return placeholders
    const q = searchPlaceholder.toLowerCase()
    return placeholders.filter(p => p.raw.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
  }, [placeholders, searchPlaceholder])

  const handleFinalApply = () => {
    if (!templateUrl) {
      toast({ title: "Belum Ada File", description: "Unggah berkas template .docx terlebih dahulu.", variant: "destructive" })
      return
    }

    const newFields: WizardGeneratedField[] = []
    const now = Date.now()

    // 1. Generate Local Direct Fields (e.g. nama, alamat, hp)
    const localPlaceholders = placeholders.filter(p => p.enabled && p.source === "local")
    localPlaceholders.forEach((p, idx) => {
      newFields.push({
        id: `field_auto_${now}_${idx}`,
        name: p.name,
        slug: p.key,
        type: p.inferredType,
        required: false,
        unique: false,
        options: {},
      })
    })

    // 2. Generate Relation Field if selected (e.g. Pejabat)
    if (selectedRelationSlug && selectedRelationSlug !== "none" && createRelationField) {
      const targetCT = availableContentTypes.find(c => c.slug === selectedRelationSlug)
      const relName = targetCT ? targetCT.name : generateReadableName(selectedRelationSlug)
      const relSlug = selectedRelationSlug.toLowerCase().replace(/[^a-z0-9_]/g, "_")

      // Only add if relation field doesn't already exist
      if (!existingFields.some(f => f.slug === relSlug) && !newFields.some(f => f.slug === relSlug)) {
        newFields.push({
          id: `field_rel_${now}`,
          name: relName,
          slug: relSlug,
          type: "relation",
          required: false,
          unique: false,
          options: {
            multiple: false,
            targetSlug: selectedRelationSlug,
            targetModel: "content-type",
            relationType: "manyToOne",
          },
          relationType: "manyToOne",
          targetModel: "content-type",
          targetSlug: selectedRelationSlug,
          relationSlug: selectedRelationSlug,
        })
      }
    }

    const templateOptions = {
      templateUrl,
      fileUrl: templateUrl,
      templateName,
      fileName: templateName,
      relationSlug: selectedRelationSlug !== "none" ? selectedRelationSlug : undefined,
      placeholders: placeholders.map(p => ({
        key: p.key,
        raw: p.raw,
        name: p.name,
        source: p.source,
      })),
    }

    onApply(newFields, templateOptions)
  }

  return (
    <div className="flex flex-col space-y-4 pb-2">
      {/* Upload Zone */}
      {!templateUrl ? (
        <div className="border-2 border-dashed border-primary/30 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all rounded-2xl p-6 text-center cursor-pointer relative group">
          <input
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={isUploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center gap-2.5 pointer-events-none">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {isUploading ? "Menganalisis & Mengekstrak Dokumen..." : "Unggah Master Template Surat (.docx)"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pilih atau seret berkas Word yang berisi tag placeholder seperti <code>{"{nama}"}</code>, <code>{"{nomor_surat}"}</code>, dll.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">{templateName}</span>
                <Badge variant="secondary" className="text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                  {placeholders.length} Variabel Ditemukan
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Siap dikonfigurasi dan di-generate otomatis menjadi field skema.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive"
            onClick={() => {
              setTemplateUrl("")
              setTemplateFile(null)
              setPlaceholders([])
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Ganti Berkas
          </Button>
        </div>
      )}

      {/* Placeholders Configuration & Mapping Section */}
      {placeholders.length > 0 && (
        <div className="space-y-4">
          
          {/* Relation Selector */}
          {availableContentTypes.length > 0 && (
            <Card className="rounded-2xl border-primary/20 bg-primary/5 p-3.5 shadow-xs">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="space-y-2 flex-1">
                  <div>
                    <Label className="text-xs font-bold text-foreground">
                      Hubungkan dengan Koleksi Relasi (Misal: Pejabat, Pegawai, Kategori)
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Variabel yang bersumber dari koleksi relasi akan diisi otomatis dari entri relasi yang dipilih.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-0.5">
                    <Select value={selectedRelationSlug} onValueChange={setSelectedRelationSlug}>
                      <SelectTrigger className="h-8 w-60 text-xs font-bold rounded-xl bg-background border-border/80">
                        <SelectValue placeholder="Pilih Koleksi Relasi (Opsional)" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="none" className="text-xs font-medium">Tanpa Relasi Khusus</SelectItem>
                        {availableContentTypes.map(ct => (
                          <SelectItem key={ct.slug} value={ct.slug} className="text-xs font-medium cursor-pointer">
                            {ct.name} ({ct.slug})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedRelationSlug && selectedRelationSlug !== "none" && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="autoCreateRel"
                          checked={createRelationField}
                          onCheckedChange={c => setCreateRelationField(!!c)}
                          className="rounded-md"
                        />
                        <Label htmlFor="autoCreateRel" className="text-xs font-semibold cursor-pointer text-foreground">
                          Otomatis Buat Field Relasi di Koleksi Ini
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Placeholders Table */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-xs font-bold text-foreground">
                  Pemetaan Variabel Placeholder ➔ Field Skema
                </Label>
                <Badge variant="outline" className="text-[10px] font-mono font-bold py-0 h-5">
                  {placeholders.filter(p => p.enabled).length} / {placeholders.length} Aktif
                </Badge>
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-6 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-md"
                >
                  <CheckSquare className="h-3 w-3 mr-1" /> Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDeselectAll}
                  className="h-6 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-md"
                >
                  <Square className="h-3 w-3 mr-1" /> Batal Semua
                </Button>
              </div>
            </div>

            {/* Placeholder Search if > 4 items */}
            {placeholders.length > 4 && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchPlaceholder}
                  onChange={e => setSearchPlaceholder(e.target.value)}
                  placeholder="Cari variabel..."
                  className="h-7 pl-8 text-xs rounded-lg bg-background border-border/80"
                />
              </div>
            )}

            {/* Scrollable Container with Smooth Native Scrollbar */}
            <div className="max-h-[340px] overflow-y-auto border border-border/70 rounded-2xl bg-card p-1 shadow-inner space-y-1.5 custom-scrollbar">
              {filteredPlaceholders.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Tidak ada variabel yang cocok dengan "{searchPlaceholder}".
                </div>
              ) : (
                filteredPlaceholders.map((p) => {
                  const originalIndex = placeholders.findIndex(item => item.key === p.key)
                  const targetIdx = originalIndex >= 0 ? originalIndex : 0

                  return (
                    <div 
                      key={p.key} 
                      className={`p-2.5 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 text-xs transition-all ${
                        p.enabled 
                          ? "bg-background border-border shadow-2xs" 
                          : "bg-muted/40 border-border/40 opacity-60"
                      }`}
                    >
                      {/* Checkbox and Tag */}
                      <div className="flex items-center gap-2 min-w-[140px] sm:w-[170px]">
                        <Checkbox
                          checked={p.enabled}
                          onCheckedChange={() => handleTogglePlaceholder(targetIdx)}
                          className="rounded-md shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono font-bold text-primary truncate text-xs">{p.raw}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{p.key}</span>
                        </div>
                      </div>

                      {/* Field Name Input */}
                      <div className="flex-1 min-w-[130px]">
                        <Input
                          value={p.name}
                          disabled={!p.enabled}
                          onChange={e => handleUpdateFieldName(targetIdx, e.target.value)}
                          placeholder="Label Field"
                          className="h-8 text-xs rounded-lg bg-card border-border/80 font-medium"
                        />
                      </div>

                      {/* Field Type Selector */}
                      <div className="w-[130px] shrink-0">
                        <Select
                          value={p.inferredType}
                          disabled={!p.enabled}
                          onValueChange={v => handleUpdateFieldType(targetIdx, v)}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-lg bg-card border-border/80">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="text" className="text-xs">Teks Singkat</SelectItem>
                            <SelectItem value="textarea" className="text-xs">Teks Paragraf</SelectItem>
                            <SelectItem value="number" className="text-xs">Angka / Ref</SelectItem>
                            <SelectItem value="phone" className="text-xs">Nomor HP</SelectItem>
                            <SelectItem value="date" className="text-xs">Tanggal</SelectItem>
                            <SelectItem value="currency" className="text-xs">Mata Uang</SelectItem>
                            <SelectItem value="media" className="text-xs">Gambar / Media</SelectItem>
                            <SelectItem value="richtext" className="text-xs">Rich Text (HTML)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Source Switcher: Local vs Relation */}
                      <div className="w-[140px] shrink-0">
                        {selectedRelationSlug && selectedRelationSlug !== "none" ? (
                          <Select
                            value={p.source}
                            disabled={!p.enabled}
                            onValueChange={v => handleUpdateSource(targetIdx, v as "local" | "relation")}
                          >
                            <SelectTrigger className="h-8 text-[11px] font-bold rounded-lg bg-card border-border/80">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border bg-card">
                              <SelectItem value="local" className="text-xs font-medium">
                                ➕ Input Manual
                              </SelectItem>
                              <SelectItem value="relation" className="text-xs font-medium text-primary">
                                🔗 Dari Relasi
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-mono h-7 px-2 flex items-center justify-center">
                            Input Manual
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Action Bar (Pinned cleanly with high visibility) */}
          <div className="flex items-center justify-between pt-3 border-t border-border/70 bg-card">
            <p className="text-[11px] text-muted-foreground hidden sm:inline">
              Semua field yang dicentang akan otomatis dibuat ke skema koleksi.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8.5 rounded-xl text-xs font-semibold px-3"
                onClick={onCancel}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8.5 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5 px-4"
                onClick={handleFinalApply}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Buat Semua Field Otomatis
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
