"use client"

import React, { useState } from "react"
import { FileText, Download, Copy, Check, Info, FileUp, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"

interface DocumentTemplateFieldProps {
  field: any
  value?: any
  onChange?: (value: any) => void
  tenantSlug: string
  contentTypeSlug?: string
  entryId?: string
  allFields?: any[]
  entryData?: Record<string, unknown>
}

export function DocumentTemplateField({
  field,
  value,
  onChange,
  tenantSlug,
  contentTypeSlug,
  entryId,
  allFields = [],
  entryData = {},
}: DocumentTemplateFieldProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Parse field options to get the uploaded template URL or metadata
  let options: any = {}
  if (field?.options) {
    try {
      options = typeof field.options === "string" ? JSON.parse(field.options) : field.options
    } catch {
      options = {}
    }
  }

  const templateUrl = options?.templateUrl || options?.fileUrl || (typeof value === "string" ? value : value?.url)
  const templateFileName = options?.fileName || (templateUrl ? templateUrl.split("/").pop() : "Format_Surat_Template.docx")

  // Generate available placeholder variables from sibling fields
  const availablePlaceholders = allFields
    .filter((f) => f.slug && f.slug !== field.slug)
    .map((f) => ({
      slug: f.slug,
      name: f.name || f.slug,
      type: f.type,
      tag: `{${f.slug}}`,
    }))

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag)
    setCopiedKey(tag)
    toast({
      title: "Tag Disalin",
      description: `Placeholder ${tag} disalin ke clipboard untuk digunakan di Word template.`,
    })
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleDownloadDocx = () => {
    if (!contentTypeSlug || !entryId) {
      if (templateUrl) {
        window.open(templateUrl, "_blank")
      } else {
        toast({
          title: "Belum Tersedia",
          description: "Simpan entri ini terlebih dahulu untuk menghasilkan dokumen terisi.",
        })
      }
      return
    }

    const exportUrl = `/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entryId}`
    window.open(exportUrl, "_blank")
  }

  return (
    <Card className="border border-border/80 bg-card/60 backdrop-blur-xs rounded-2xl overflow-hidden shadow-xs">
      <CardContent className="p-4 space-y-4">
        {/* Template Header & Status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">Template Word (.docx)</span>
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  DOCX MERGE READY
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px] sm:max-w-md">
                {templateFileName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {templateUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold rounded-xl gap-1.5"
                onClick={() => window.open(templateUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Unduh Template Master
              </Button>
            )}

            {entryId && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-8 text-xs font-bold rounded-xl gap-1.5 shadow-xs"
                onClick={handleDownloadDocx}
              >
                <Download className="h-3.5 w-3.5" />
                Generate Surat Entri Ini
              </Button>
            )}
          </div>
        </div>

        {/* Placeholders Cheat-Sheet */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Info className="h-3.5 w-3.5 text-primary" />
            <span>Placeholder Variabel untuk Template Word</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Ketik tag kurung kurawal di berkas Microsoft Word (.docx) Anda. Saat surat digenerate, SaCMS akan otomatis mengganti tag dengan data yang diisi pada entri ini:
          </p>

          {availablePlaceholders.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {availablePlaceholders.map((item) => (
                <TooltipProvider key={item.slug}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleCopyTag(item.tag)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-muted/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/80 transition-all cursor-pointer group"
                      >
                        <span>{item.tag}</span>
                        {copiedKey === item.tag ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors opacity-70" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Klik untuk menyalin placeholder untuk field <strong>{item.name}</strong> ({item.type})
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground p-2 rounded-xl bg-muted/30 border border-dashed border-border/80">
              Belum ada field lain dalam skema ini. Tambahkan field seperti <code>nama</code>, <code>tanggal</code>, <code>alamat</code> di Content Type Builder.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
