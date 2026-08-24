"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

interface DateRangeFieldProps {
  value: { from: string; to: string } | null
  onChange: (value: { from: string; to: string } | null) => void
  label?: string
  required?: boolean
  error?: string
}

export function DateRangeField({
  value,
  onChange,
  label,
  required = false,
  error
}: DateRangeFieldProps) {
  const [date, setDate] = useState<DateRange | undefined>(
    value?.from 
      ? { 
          from: new Date(value.from), 
          to: value.to ? new Date(value.to) : undefined 
        } 
      : undefined
  )

  const handleSelect = (range: DateRange | undefined) => {
    setDate(range)
    if (range?.from) {
      onChange({
        from: range.from.toISOString(),
        to: range.to ? range.to.toISOString() : ""
      })
    } else {
      onChange(null)
    }
  }

  return (
    <div className="space-y-2">
      {label && (
        <Label className={cn(error ? "text-destructive" : "")}>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      <div className={cn("grid gap-2")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-medium rounded-xl h-10 border-border/80 bg-background text-xs cursor-pointer",
                !date && "text-muted-foreground font-normal",
                error ? "border-destructive focus-visible:ring-destructive" : ""
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date?.from ? (
                date.to ? (
                  <>
                    {format(date.from, "LLL dd, y")} -{" "}
                    {format(date.to, "LLL dd, y")}
                  </>
                ) : (
                  format(date.from, "LLL dd, y")
                )
              ) : (
                <span>Pilih rentang tanggal...</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl border-border bg-card shadow-xl overflow-hidden" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
