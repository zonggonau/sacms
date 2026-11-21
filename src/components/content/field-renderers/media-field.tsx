"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, FileText, ExternalLink, RefreshCw, Trash2 } from "lucide-react"
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
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  const previewUnavailable = type === "image" && failedPreview === value

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFailedPreview(null)
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
                {previewUnavailable ? (
                  <ImageIcon className="absolute inset-0 m-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <img
                    key={value}
                    src={value}
                    alt="Pratinjau gambar yang dipilih"
                    className="w-full h-full object-cover"
                    onError={() => setFailedPreview(value)}
                  />
                )}
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
                <FileText className="h-7 w-7" />
              </div>
            )}

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  role={type === "image" ? "status" : undefined}
                  className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full"
                >
                  {type === "image" ? "Gambar dipilih" : "Attachment File"}
                </Badge>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 font-mono truncate"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" /> {type === "image" ? "Buka gambar" : "Buka URL"}
                </a>
              </div>
              {previewUnavailable && (
                <p className="text-xs text-muted-foreground">Pratinjau gambar tidak dapat dimuat.</p>
              )}
              {type === "file" && (
                <Input
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="h-8 text-xs font-mono bg-background border-border/80 rounded-lg"
                  placeholder="https://..."
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Ganti"
                className="size-8 rounded-lg border-border/80 hover:bg-muted"
                onClick={() => setShowMediaLibrary(true)}
              >
                <RefreshCw aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Hapus"
                className="size-8 rounded-lg text-destructive hover:bg-destructive/10"
                onClick={handleClear}
              >
                <Trash2 aria-hidden="true" />
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
              Pilih dari Media Library atau unggah file baru
            </span>
          </div>
        </button>
      )}

      <MediaLibraryDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={(media) => {
          setFailedPreview(null)
          onChange(media.url)
        }}
        mediaType={type}
        tenantSlug={tenantSlug}
      />
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  )
}
