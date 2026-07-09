"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface RatingFieldProps {
  value: number | null
  onChange: (value: number) => void
  label?: string | React.ReactNode
  required?: boolean
  error?: string
  maxRating?: number
}

export function RatingField({
  value,
  onChange,
  label,
  required = false,
  error,
  maxRating = 5,
}: RatingFieldProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const currentValue = value || 0

  const displayValue = hovered !== null ? hovered : currentValue

  return (
    <div className="space-y-2">
      {label && (
        typeof label === "string" ? (
          <Label className={cn(error ? "text-destructive" : "")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        ) : label
      )}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHovered(null)}
        >
          {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star === currentValue ? 0 : star)}
              onMouseEnter={() => setHovered(star)}
              className={cn(
                "p-0.5 rounded-sm transition-all duration-150 hover:scale-110 active:scale-95",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              )}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-all duration-150",
                  star <= displayValue
                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                    : "fill-none text-slate-300 hover:text-amber-200"
                )}
              />
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {currentValue > 0 && (
            <>
              <span className="text-lg font-black text-amber-600 tabular-nums">
                {currentValue}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                / {maxRating}
              </span>
              <button
                type="button"
                onClick={() => onChange(0)}
                className="text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive transition-colors ml-1"
              >
                Reset
              </button>
            </>
          )}
          {currentValue === 0 && (
            <span className="text-xs text-muted-foreground italic">
              Klik bintang untuk memberi rating
            </span>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
