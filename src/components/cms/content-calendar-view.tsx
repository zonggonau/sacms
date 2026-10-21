"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Clock, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { extractEntryLabel } from "@/lib/relation-labels"

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

interface CalendarEntry {
  id: string
  status: string
  data: any
  scheduledAt?: string | null
  publishedAt?: string | null
}

/**
 * Entries land on the calendar by whichever date is most relevant to "when
 * does this get seen live": SCHEDULED entries key off scheduledAt (the
 * future publish date the user is tracking), everything already PUBLISHED
 * keys off publishedAt. Anything with neither (draft/in-review/etc.) has no
 * date to plot and is intentionally left off this view — the table/kanban
 * views already cover those.
 */
function getCalendarDate(entry: CalendarEntry): Date | null {
  if (entry.status === "SCHEDULED" && entry.scheduledAt) return startOfDay(new Date(entry.scheduledAt))
  if (entry.publishedAt) return startOfDay(new Date(entry.publishedAt))
  return null
}

export function ContentCalendarView({
  entries,
  tenantSlug,
  contentTypeSlug,
  navBasePath,
}: {
  entries: CalendarEntry[]
  tenantSlug: string
  contentTypeSlug: string
  navBasePath: string
}) {
  const router = useRouter()
  const [cursor, setCursor] = useState(() => startOfDay(new Date()))

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>()
    for (const entry of entries) {
      const date = getCalendarDate(entry)
      if (!date) continue
      const key = date.toISOString().slice(0, 10)
      const list = map.get(key) || []
      list.push(entry)
      map.set(key, list)
    }
    return map
  }, [entries])

  const monthGrid = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const firstOfMonth = new Date(year, month, 1)
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() - firstOfMonth.getDay())

    const days: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      days.push(d)
    }
    return days
  }, [cursor])

  const today = startOfDay(new Date())

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-bold text-foreground">
          {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg text-xs font-bold"
            onClick={() => setCursor(startOfDay(new Date()))}
          >
            Hari Ini
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border/60 bg-muted/20">
        {WEEKDAY_LABELS.map(label => (
          <div key={label} className="py-2 text-center text-[10px] uppercase font-bold text-muted-foreground">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthGrid.map((day, idx) => {
          const key = day.toISOString().slice(0, 10)
          const dayEntries = entriesByDay.get(key) || []
          const isCurrentMonth = day.getMonth() === cursor.getMonth()
          const isToday = day.getTime() === today.getTime()

          return (
            <div
              key={idx}
              className={cn(
                "min-h-[104px] border-b border-r border-border/60 p-1.5 [&:nth-child(7n)]:border-r-0",
                !isCurrentMonth && "bg-muted/10"
              )}
            >
              <div className={cn(
                "text-[11px] font-bold mb-1 h-5 w-5 flex items-center justify-center rounded-full",
                isToday ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
              )}>
                {day.getDate()}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 3).map(entry => {
                  const isScheduled = entry.status === "SCHEDULED"
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${entry.id}`)}
                      title={extractEntryLabel(entry.data, entry.id)}
                      className={cn(
                        "flex items-center gap-1 w-full rounded-md px-1.5 py-1 text-[10px] font-semibold truncate text-left",
                        isScheduled
                          ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      )}
                    >
                      {isScheduled ? <Clock className="h-2.5 w-2.5 shrink-0" /> : <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                      <span className="truncate">{extractEntryLabel(entry.data, entry.id)}</span>
                    </button>
                  )
                })}
                {dayEntries.length > 3 && (
                  <div className="text-[10px] font-medium text-muted-foreground px-1.5">
                    +{dayEntries.length - 3} lainnya
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/60 bg-muted/10">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-purple-500/60" /> Terjadwal
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" /> Dipublikasikan
        </div>
      </div>
    </Card>
  )
}
