"use client"

import { cn } from "@/lib/utils"

interface JsonViewerProps {
  data: any
  className?: string
}

/**
 * A simple, clean JSON viewer component with syntax highlighting colors
 */
export function JsonViewer({ data, className }: JsonViewerProps) {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Simple syntax highlighting using regex on stringified JSON
  const formatJson = (obj: any) => {
    try {
      const json = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2)
      const safeJson = escapeHtml(json)
      return safeJson.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        (match) => {
          let cls = "text-orange-600 dark:text-orange-400" // numbers
          if (/^"/.test(match)) {
            if (/:$/.test(match)) {
              cls = "text-blue-600 dark:text-blue-400 font-bold" // keys
            } else {
              cls = "text-emerald-600 dark:text-emerald-400" // strings
            }
          } else if (/true|false/.test(match)) {
            cls = "text-purple-600 dark:text-purple-400" // booleans
          } else if (/null/.test(match)) {
            cls = "text-gray-500" // null
          }
          return `<span class="${cls}">${match}</span>`
        }
      )
    } catch (e) {
      return escapeHtml(String(obj))
    }
  }

  return (
    <pre
      className={cn(
        "p-4 rounded-none bg-muted/40 dark:bg-zinc-950 font-mono text-[11px] overflow-auto max-h-[500px] border border-border text-foreground leading-relaxed",
        className
      )}
      dangerouslySetInnerHTML={{ __html: formatJson(data) }}
    />
  )
}
