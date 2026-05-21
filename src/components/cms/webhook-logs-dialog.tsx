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
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border border-border shadow-none rounded-none h-[80vh] flex flex-col bg-card">
        <div className="bg-muted/30 p-6 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none border border-border bg-orange-500 flex items-center justify-center text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">Delivery History</DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium text-xs">
                Recent delivery attempts for <span className="text-orange-500 font-bold">"{webhookName}"</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden bg-card">
          {/* List Section */}
          <div className="w-1/3 border-r border-border flex flex-col overflow-hidden">
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-20 opacity-30">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs font-bold text-foreground">No logs yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {logs.map((log) => (
                    <button
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-center gap-3 group rounded-none",
                        selectedLog?.id === log.id && "bg-muted"
                      )}
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-none",
                        log.success ? "bg-orange-500 border border-orange-600" : "bg-red-500 border border-red-600"
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
                    "p-4 rounded-none border flex items-center justify-between",
                    selectedLog.success ? "bg-orange-500/5 border-orange-500/20" : "bg-red-500/5 border-red-500/20"
                  )}>
                    <div className="flex items-center gap-3">
                      {selectedLog.success ? <CheckCircle2 className="h-5 w-5 text-orange-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                      <div>
                        <p className="text-xs font-black uppercase text-foreground">
                          {selectedLog.success ? "Successful Delivery" : "Delivery Failed"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground">
                          Status Code: {selectedLog.statusCode || "N/A"} • Duration: {selectedLog.duration}ms
                        </p>
                      </div>
                    </div>
                    <Badge variant={selectedLog.success ? "default" : "destructive"} className={cn("font-black uppercase text-[9px] tracking-widest rounded-none shadow-none border border-transparent", selectedLog.success ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-red-500 hover:bg-red-600 text-white")}>
                      {selectedLog.statusCode || "ERROR"}
                    </Badge>
                  </div>

                  {selectedLog.error && (
                    <div className="p-4 rounded-none bg-red-950/20 text-red-200 border border-red-900/50 space-y-1">
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
                      <div className="rounded-none border border-border bg-card p-4">
                        <JsonViewer data={typeof selectedLog.payload === 'string' ? JSON.parse(selectedLog.payload) : selectedLog.payload} />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-muted-foreground pl-1">
                        <ExternalLink className="h-3 w-3" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Server Response</span>
                      </div>
                      <div className="rounded-none border border-border bg-card p-4">
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
                <Terminal className="h-16 w-16 mb-4 text-muted-foreground" />
                <p className="text-sm font-black uppercase tracking-widest">Select a log to view details</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
