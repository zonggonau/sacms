"use client"

import { Badge } from "@/components/ui/badge"
import {
  FileText, Clock, CheckCircle2, CalendarClock,
  Eye, Archive, XCircle,
} from "lucide-react"

export const STATUS_CONFIG: Record<string, {
  label: string
  dot: string
  bg: string
  text: string
  icon: React.ElementType
}> = {
  DRAFT:     { label: "Draft",      dot: "bg-gray-400",    bg: "bg-gray-100 dark:bg-gray-800",               text: "text-gray-700 dark:text-gray-300",    icon: FileText },
  IN_REVIEW: { label: "In Review",  dot: "bg-yellow-500",  bg: "bg-yellow-50 dark:bg-yellow-900/30",         text: "text-yellow-700 dark:text-yellow-300", icon: Clock },
  APPROVED:  { label: "Approved",   dot: "bg-blue-500",    bg: "bg-blue-50 dark:bg-blue-900/30",             text: "text-blue-700 dark:text-blue-300",     icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled",  dot: "bg-purple-500",  bg: "bg-purple-50 dark:bg-purple-900/30",         text: "text-purple-700 dark:text-purple-300", icon: CalendarClock },
  PUBLISHED: { label: "Published",  dot: "bg-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/30",       text: "text-emerald-700 dark:text-emerald-300", icon: Eye },
  ARCHIVED:  { label: "Archived",   dot: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-900/30",         text: "text-orange-700 dark:text-orange-300", icon: Archive },
  REJECTED:  { label: "Rejected",   dot: "bg-red-500",     bg: "bg-red-50 dark:bg-red-900/30",               text: "text-red-700 dark:text-red-300",       icon: XCircle },
}

// Lowercase alias for API responses that use lowercase keys
const STATUS_ALIAS: Record<string, string> = {
  draft: "DRAFT", in_review: "IN_REVIEW", approved: "APPROVED",
  scheduled: "SCHEDULED", published: "PUBLISHED", archived: "ARCHIVED", rejected: "REJECTED",
}

function resolveStatus(status: string) {
  const key = STATUS_ALIAS[status] || status
  return STATUS_CONFIG[key]
}

export function WorkflowStatusBadge({ status, size = "sm" }: { status: string; size?: "xs" | "sm" | "md" }) {
  const cfg = resolveStatus(status)
  if (!cfg) return <Badge variant="outline">{status}</Badge>

  const sizes = {
    xs: "text-[10px] px-1.5 py-0 h-4",
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-none font-medium ${cfg.bg} ${cfg.text} ${sizes[size]}`}>
      <span className={`h-1.5 w-1.5 rounded-none ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

export function WorkflowStatusDot({ status }: { status: string }) {
  const cfg = resolveStatus(status)
  if (!cfg) return null
  return <span className={`h-2 w-2 rounded-none ${cfg.dot}`} title={cfg.label} />
}

export function WorkflowPipeline({ entries }: { entries: Record<string, number> }) {
  const total = Object.values(entries).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div>
      <div className="flex h-2.5 rounded-none overflow-hidden mb-2">
        {Object.entries(entries).map(([key, count]) => {
          if (count === 0) return null
          const cfg = resolveStatus(key)
          if (!cfg) return null
          const pct = (count / total) * 100
          return <div key={key} className={cfg.dot} style={{ width: `${pct}%` }} />
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(entries).map(([key, count]) => {
          const cfg = resolveStatus(key)
          if (!cfg) return null
          return (
            <span key={key} className={`inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
              <span className={`h-1.5 w-1.5 rounded-none ${cfg.dot}`} />
              {cfg.label} <span className="font-bold">{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
