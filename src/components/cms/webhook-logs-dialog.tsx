"use client"

import { useState, useEffect } from "react"
import { 
  History, Clock, CheckCircle2, XCircle, 
  Loader2, ChevronRight, Terminal, 
  ExternalLink, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { JsonViewer } from "@/components/ui/json-viewer"

interface WebhookLog {
  id: string
  event: string
  payload: any
  response: any
  statusCode: number | null
  success: boolean
  duration: number | null
  error: string | null
  createdAt: string
}

interface WebhookLogsDialogProps {
  tenantSlug: string
  webhookId: string
  webhookName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WebhookLogsDialog({
  tenantSlug,
  webhookId,
  webhookName,
  open,
  onOpenChange
}: WebhookLogsDialogProps) {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/webhooks/${webhookId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (error) {
      console.error("Error fetching webhook logs:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchLogs()
      setSelectedLog(null)
    }
  }, [open, webhookId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl h-[80vh] flex flex-col">
        <div className="bg-zinc-900 p-6 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <History className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Delivery History</DialogTitle>
              <DialogDescription className="text-zinc-400 font-medium">
                Recent delivery attempts for <span className="text-emerald-400">"{webhookName}"</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-card">
          {/* List Section */}
          <div className="w-1/3 border-r border-muted flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold">No logs yet</p>
                </div>
              ) : (
                <div className="divide-y divide-muted">
                  {logs.map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 group",
                        selectedLog?.id === log.id && "bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        log.success ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-wider text-foreground truncate">{log.event}</p>
                        <p className="text-[9px] font-bold text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</p>
                      </div>
                      <ChevronRight className={cn(
                        "h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all",
                        selectedLog?.id === log.id && "opacity-100 translate-x-1"
                      )} />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Detail Section */}
          <div className="flex-1 bg-muted/5 overflow-hidden flex flex-col">
            {selectedLog ? (
              <ScrollArea className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Status Card */}
                  <div className={cn(
                    "p-4 rounded-2xl border flex items-center justify-between",
                    selectedLog.success ? "bg-emerald-50/50 border-emerald-100" : "bg-red-50/50 border-red-100"
                  )}>
                    <div className="flex items-center gap-3">
                      {selectedLog.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                      <div>
                        <p className="text-xs font-black uppercase text-foreground">
                          {selectedLog.success ? "Successful Delivery" : "Delivery Failed"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground">
                          Status Code: {selectedLog.statusCode || "N/A"} • Duration: {selectedLog.duration}ms
                        </p>
                      </div>
                    </div>
                    <Badge variant={selectedLog.success ? "default" : "destructive"} className="font-black uppercase text-[9px] tracking-widest">
                      {selectedLog.statusCode || "ERROR"}
                    </Badge>
                  </div>

                  {selectedLog.error && (
                    <div className="p-4 rounded-2xl bg-red-950 text-red-200 border border-red-900/50 space-y-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Error Detail</span>
                      </div>
                      <p className="text-xs font-mono">{selectedLog.error}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground pl-1">
                        <Terminal className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Request Payload</span>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        <JsonViewer data={typeof selectedLog.payload === 'string' ? JSON.parse(selectedLog.payload) : selectedLog.payload} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground pl-1">
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Server Response</span>
                      </div>
                      <div className="rounded-2xl border bg-card p-4">
                        {selectedLog.response ? (
                          <div className="text-xs font-mono break-all text-foreground whitespace-pre-wrap">
                            {selectedLog.response}
                          </div>
                        ) : (
                          <p className="text-xs italic text-muted-foreground">No response body</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-20">
                <Terminal className="h-16 w-16 mb-4" />
                <p className="text-sm font-black uppercase tracking-widest">Select a log to view details</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
