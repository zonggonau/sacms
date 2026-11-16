"use client"

import { useState } from "react"
import { ImageIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { RichTextEditor } from "@/components/rich-text-editor"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import type { CmsFieldConfig } from "./cms-section-config"

interface CmsFieldInputProps {
  field: CmsFieldConfig
  value: unknown
  onChange: (value: unknown) => void
}

export function CmsFieldInput({ field, value, onChange }: CmsFieldInputProps) {
  const [mediaOpen, setMediaOpen] = useState(false)

  if (field.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1">
        <Label className="text-xs font-bold">{field.label}</Label>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold">{field.label}</Label>
      {field.type === "richtext" ? (
        <RichTextEditor value={(value as string) || ""} onChange={onChange} minHeight={200} />
      ) : field.type === "textarea" ? (
        <Textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="text-xs rounded-xl min-h-[90px]"
          placeholder={field.hint}
        />
      ) : field.type === "number" ? (
        <Input
          type="number"
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className="h-9 text-xs rounded-xl"
          placeholder={field.hint}
        />
      ) : field.type === "image" ? (
        <div className="flex items-center gap-2">
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 text-xs rounded-xl font-mono flex-1"
            placeholder="https://..."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setMediaOpen(true)}
            className="h-9 text-[11px] font-bold rounded-xl border-border/80 shrink-0"
          >
            <ImageIcon className="h-3.5 w-3.5 mr-1" /> Pilih
          </Button>
          <MediaLibraryDialog
            open={mediaOpen}
            onOpenChange={setMediaOpen}
            mediaType="image"
            onSelect={(media) => { onChange(media.url); setMediaOpen(false) }}
          />
        </div>
      ) : (
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 text-xs rounded-xl"
          placeholder={field.hint}
        />
      )}
      {field.hint && field.type !== "image" && field.type !== "textarea" && field.type !== "number" && (
        <p className="text-[10px] text-muted-foreground">{field.hint}</p>
      )}
    </div>
  )
}
