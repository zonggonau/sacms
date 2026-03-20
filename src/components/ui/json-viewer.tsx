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
  // Simple syntax highlighting using regex on stringified JSON
  const formatJson = (obj: any) => {
    try {
      const json = JSON.stringify(obj, null, 2)
      return json.replace(
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
      return String(obj)
    }
  }

  return (
    <pre
      className={cn(
        "p-4 rounded-xl bg-muted/30 font-mono text-[11px] overflow-auto max-h-[500px] border leading-relaxed",
        className
      )}
      dangerouslySetInnerHTML={{ __html: formatJson(data) }}
    />
  )
}
