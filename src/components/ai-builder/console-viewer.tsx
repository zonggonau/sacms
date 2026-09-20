"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Terminal } from "lucide-react"

export interface ConsoleLogEntry {
  id: string
  time: string
  type: "info" | "success" | "warn"
  text: string
}

interface ConsoleViewerProps {
  logs: ConsoleLogEntry[]
}

/**
 * Terminal-style console log viewer.
 * Shows build logs, compilation status, and API request logs.
 */
export function ConsoleViewer({ logs }: ConsoleViewerProps) {
  return (
    <div className="flex-1 bg-slate-950 text-slate-200 p-4 flex flex-col font-mono text-xs overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-emerald-400" />
          <span className="font-bold text-white">Next.js Fast Compiler Stream</span>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
          Live Edge Proxy
        </Badge>
      </div>

      <ScrollArea className="flex-1 pt-3">
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3">
              <span className="text-slate-500 shrink-0">[{log.time}]</span>
              <span className={
                log.type === "success"
                  ? "text-emerald-400 font-semibold"
                  : log.type === "warn"
                  ? "text-amber-400"
                  : "text-slate-300"
              }>
                {log.text}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
