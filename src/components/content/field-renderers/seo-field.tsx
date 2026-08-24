"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { SearchCheck, Globe, Image as ImageIcon } from "lucide-react"

export interface SeoFieldValue {
  meta_title?: string
  meta_description?: string
  keywords?: string
  og_image?: string
  no_index?: boolean
}

interface SeoFieldProps {
  value: SeoFieldValue | null | undefined
  onChange: (value: SeoFieldValue) => void
  disabled?: boolean
  required?: boolean
}

export function SeoField({
  value,
  onChange,
  disabled = false,
}: SeoFieldProps) {
  const seoData: SeoFieldValue = typeof value === "object" && value !== null
    ? value
    : {}

  const handleFieldChange = (key: keyof SeoFieldValue, val: any) => {
    onChange({
      ...seoData,
      [key]: val,
    })
  }

  const titleLength = seoData.meta_title?.length || 0
  const descLength = seoData.meta_description?.length || 0

  return (
    <div className="space-y-4 p-4 rounded-2xl border border-border/80 bg-muted/20 shadow-xs">
      {/* SERP Google Preview */}
      <div className="p-3.5 rounded-xl border border-border/60 bg-background space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Globe className="h-3 w-3 text-primary" />
          <span>Pratinjau Hasil Pencarian Google</span>
        </div>
        <p className="text-sm font-bold text-blue-600 dark:text-blue-400 truncate">
          {seoData.meta_title || "Judul Halaman Website | Nama Brand"}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {seoData.meta_description || "Deskripsi ringkas yang menarik pembaca dan relevan dengan konten halaman ini akan muncul di sini..."}
        </p>
      </div>

      {/* Meta Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">Meta Title</Label>
          <span className={`text-[10px] font-mono ${titleLength > 60 ? "text-amber-500 font-bold" : "text-muted-foreground"}`}>
            {titleLength}/60 karakter
          </span>
        </div>
        <Input
          value={seoData.meta_title || ""}
          onChange={(e) => handleFieldChange("meta_title", e.target.value)}
          placeholder="Judul SEO optimal (maks 60 karakter)..."
          disabled={disabled}
          className="h-8.5 bg-background border-border/80 rounded-xl text-xs"
        />
      </div>

      {/* Meta Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold text-foreground">Meta Description</Label>
          <span className={`text-[10px] font-mono ${descLength > 160 ? "text-amber-500 font-bold" : "text-muted-foreground"}`}>
            {descLength}/160 karakter
          </span>
        </div>
        <Textarea
          value={seoData.meta_description || ""}
          onChange={(e) => handleFieldChange("meta_description", e.target.value)}
          placeholder="Deskripsi rangkuman untuk mesin pencari..."
          disabled={disabled}
          rows={2}
          className="bg-background border-border/80 rounded-xl text-xs resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
        {/* Keywords */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">Keywords (Pisahkan Koma)</Label>
          <Input
            value={seoData.keywords || ""}
            onChange={(e) => handleFieldChange("keywords", e.target.value)}
            placeholder="cms, headless, react..."
            disabled={disabled}
            className="h-8.5 bg-background border-border/80 rounded-xl text-xs"
          />
        </div>

        {/* OG Image URL */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-foreground">Open Graph Image (URL)</Label>
          <div className="relative">
            <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={seoData.og_image || ""}
              onChange={(e) => handleFieldChange("og_image", e.target.value)}
              placeholder="https://domain.com/og.jpg"
              disabled={disabled}
              className="pl-9 h-8.5 bg-background border-border/80 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* No Index Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="space-y-0.5">
          <Label className="text-xs font-semibold text-foreground">NoIndex / NoFollow</Label>
          <p className="text-[10px] text-muted-foreground">Cegah mesin pencari mengindeks halaman ini</p>
        </div>
        <Switch
          checked={!!seoData.no_index}
          onCheckedChange={(checked) => handleFieldChange("no_index", checked)}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
