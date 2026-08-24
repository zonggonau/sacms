"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, FileText, X, Upload, ExternalLink, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface MediaFieldProps {
  value: string | null
  onChange: (value: string) => void
  type?: "image" | "file"
  label?: React.ReactNode
  required?: boolean
  error?: string
  tenantSlug?: string
}

export function MediaField({ value, onChange, type = "image", label, required, error, tenantSlug }: MediaFieldProps) {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange("")
  }

  return (
    <div className="space-y-2">
      {label && (
        typeof label === 'string' ? (
          <Label className="text-xs font-bold text-foreground">
            {label}
            {required && <span className="text-primary ml-1">*</span>}
          </Label>
        ) : label
      )}

      {value ? (
        <div className="relative rounded-2xl border border-border/80 overflow-hidden bg-muted/20 group hover:border-primary/40 transition-all">
          <div className="p-3 flex items-center gap-3">
            {type === "image" ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted border border-border/60 shrink-0 relative">
                <img
                  src={value}
                  alt="Selected Asset"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <FileText className="h-7 w-7" />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  {type === "image" ? "Media Image" : "Attachment File"}
                </Badge>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-mono truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" /> Buka URL
                </a>
              </div>
              <Input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-8 text-xs font-mono bg-background border-border/80 rounded-lg"
                placeholder="https://..."
              />
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs font-bold rounded-lg border-border/80 hover:bg-muted"
                onClick={() => setShowMediaLibrary(true)}
              >
                <RefreshCw className="h-3 w-3 mr-1" /> Ganti
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs font-bold rounded-lg text-destructive hover:bg-destructive/10"
                onClick={handleClear}
              >
                <X className="h-3 w-3 mr-1" /> Hapus
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="w-full h-28 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/10 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer text-center"
          onClick={() => setShowMediaLibrary(true)}
        >
          <div className="w-9 h-9 rounded-xl bg-muted group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary flex items-center justify-center transition-colors">
            {type === "image" ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </div>
          <div>
            <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors block">
              Pilih atau Unggah {type === "image" ? "Gambar" : "File"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              Pilih dari Cloudflare R2 Media Library atau unggah file baru
            </span>
          </div>
        </button>
      )}

      <MediaLibraryDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={(media) => onChange(media.url)}
        mediaType={type}
        tenantSlug={tenantSlug}
      />
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  )
}