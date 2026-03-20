"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, X, Image as ImageIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface MediaMultipleFieldProps {
  value: string[] | null
  onChange: (value: string[]) => void
  required?: boolean
  label?: string
}

export function MediaMultipleField({
  value = [],
  onChange,
  required,
  label,
}: MediaMultipleFieldProps) {
  const handleRemove = (index: number) => {
    const newValue = (value || []).filter((_, i) => i !== index)
    onChange(newValue)
  }

  const handleAddMedia = () => {
    // For now, just add a placeholder URL
    // In a real implementation, this would open a media library dialog
    const mockUrl = `https://via.placeholder.com/150/${(value || []).length}`
    onChange([...(value || []), mockUrl])
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className="space-y-2">
        {value && value.length > 0 ? (
          <div className="grid grid-cols-4 gap-2">
            {value.map((mediaUrl, index) => (
              <Card key={index} className="relative group">
                <CardContent className="p-0">
                  <div className="aspect-square relative overflow-hidden rounded-lg bg-muted">
                    {mediaUrl && (
                      <img
                        src={mediaUrl}
                        alt={`Media ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    )}
                    {!mediaUrl && (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </CardContent>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-4 border rounded-lg">
            No media selected
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={handleAddMedia}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Add Media
        </Button>
      </div>
    </div>
  )
}