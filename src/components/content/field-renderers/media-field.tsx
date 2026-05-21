"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { Label } from "@/components/ui/label"
import { Image as ImageIcon, FileText, X, Upload } from "lucide-react"

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

  const handleClear = () => {
    onChange("")
  }

  return (
    <div className="space-y-2">
      {label && (
        typeof label === 'string' ? (
          <Label>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        ) : label
      )}
      {value ? (
        <div className="relative border rounded-none overflow-hidden">
          {type === "image" ? (
            <img
              src={value}
              alt="Selected"
              className="w-full h-48 object-cover"
            />
          ) : (
            <div className="h-48 flex items-center justify-center bg-muted">
              <FileText className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="p-2 bg-background/90 absolute bottom-0 left-0 right-0">
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="text-sm"
              placeholder="Media URL"
            />
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-32 border-dashed"
          onClick={() => setShowMediaLibrary(true)}
        >
          <div className="flex flex-col items-center gap-2">
            {type === "image" ? (
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileText className="h-8 w-8 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">
              Click to {type === "image" ? "select image" : "select file"}
            </span>
          </div>
        </Button>
      )}

      <MediaLibraryDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={(media) => onChange(media.url)}
        mediaType={type}
        tenantSlug={tenantSlug}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}