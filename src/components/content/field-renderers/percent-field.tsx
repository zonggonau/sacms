"use client"

import { Input } from "@/components/ui/input"
import { Percent } from "lucide-react"

interface PercentFieldProps {
  value: number | string | null | undefined
  onChange: (value: number) => void
  required?: boolean
  disabled?: boolean
  min?: number
  max?: number
  step?: number
}

export function PercentField({
  value,
  onChange,
  required = false,
  disabled = false,
  min = 0,
  max = 100,
  step = 1,
}: PercentFieldProps) {
  const numericValue = typeof value === "number" ? value : Number(value) || 0

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    if (isNaN(val)) {
      onChange(0)
    } else {
      const clamped = Math.min(Math.max(val, min), max)
      onChange(clamped)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            type="number"
            value={value !== null && value !== undefined ? value : ""}
            onChange={handleInputChange}
            min={min}
            max={max}
            step={step}
            required={required}
            disabled={disabled}
            placeholder="0"
            className="pr-9 h-9 bg-background border-border/80 rounded-xl text-xs font-mono font-bold"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-muted-foreground">
            <Percent className="h-3.5 w-3.5" />
          </div>
        </div>

        {/* Mini Range Slider */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={numericValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          disabled={disabled}
          className="w-32 h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
        />

        <span className="text-xs font-bold font-mono text-primary w-12 text-right">
          {numericValue}%
        </span>
      </div>

      {/* Progress Bar Visualization */}
      <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300 rounded-full"
          style={{ width: `${Math.min(Math.max(numericValue, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}
