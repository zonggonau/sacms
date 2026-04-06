"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X, Image as ImageIcon, Plus } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { MediaLibraryDialog } from "@/components/media-library-dialog"

interface MediaMultipleFieldProps {
  value: string[] | null
  onChange: (value: string[]) => void
  required?: boolean
  label?: string
  tenantSlug?: string
}

export function MediaMultipleField({
  value = [],
  onChange,
  required,
  label,
  tenantSlug,
}: MediaMultipleFieldProps) {
  const [showMediaLibrary, setShowMediaLibrary] = useState(false)

  const handleRemove = (index: number) => {
    const newValue = (value || []).filter((_, i) => i !== index)
    onChange(newValue)
  }

  const handleSelectMedia = (media: { url: string }) => {
    const currentValues = Array.isArray(value) ? value : []
    onChange([...currentValues, media.url])
    setShowMediaLibrary(false)
  }

  return (
    <div className="space-y-4">
      {label && (
        <Label className="text-sm font-bold">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {value && value.length > 0 && value.map((mediaUrl, index) => (
          <Card key={index} className="relative group border-none shadow-sm overflow-hidden rounded-2xl bg-muted/20 aspect-square">
            <CardContent className="p-0 h-full w-full">
              <div className="h-full w-full relative group">
                {mediaUrl && (
                  <img
                    src={mediaUrl}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                )}
                {!mediaUrl && (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={() => handleRemove(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowMediaLibrary(true)}
          className="aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 rounded-2xl transition-all h-full w-full"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Plus className="h-5 w-5 text-primary" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Add Media</span>
        </Button>
      </div>

      <MediaLibraryDialog
        open={showMediaLibrary}
        onOpenChange={setShowMediaLibrary}
        onSelect={handleSelectMedia}
        mediaType="image"
        tenantSlug={tenantSlug}
      />
    </div>
  )
}