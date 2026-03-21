"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Fingerprint, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SlugFieldProps {
  value: string
  onChange: (value: string) => void
  required?: boolean
  label?: string | React.ReactNode
  placeholder?: string
  onGenerate?: () => void
}

export function SlugField({
  value,
  onChange,
  required,
  label,
  placeholder,
  onGenerate
}: SlugFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {typeof label === 'string' ? (
          <Label className="text-sm font-bold">
            {label} {required && "*"}
          </Label>
        ) : label}
        {onGenerate && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-[10px] font-bold uppercase gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={(e) => {
              e.preventDefault();
              onGenerate();
            }}
          >
            <RefreshCcw className="h-3 w-3" /> Regenerate
          </Button>
        )}
      </div>
      <div className="relative">
        <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "enter-slug-here"}
          required={required}
          className="pl-9 font-mono text-sm bg-muted/20 border-emerald-100/50"
        />
      </div>
    </div>
  )
}
