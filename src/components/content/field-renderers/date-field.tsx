"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateFieldProps {
  value: string | null
  onChange: (value: string | null) => void
  label?: string
  placeholder?: string
  required?: boolean
  error?: string
  includeTime?: boolean
}

export function DateField({
  value,
  onChange,
  label,
  placeholder = "Select date...",
  required = false,
  error,
  includeTime = false,
}: DateFieldProps) {
  const [open, setOpen] = useState(false)

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === "") return placeholder
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return placeholder
      return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    } catch (e) {
      return placeholder
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label className={error ? "text-destructive" : ""}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={`w-full justify-start text-left font-normal h-10 bg-card ${
              !value && "text-muted-foreground"
            } ${error ? "border-destructive" : ""}`}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {formatDate(value)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
          <CalendarComponent
            mode="single"
            selected={value && value !== "" ? new Date(value) : undefined}
            onSelect={(date) => {
              onChange(date ? date.toISOString() : null)
              setOpen(false)
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}