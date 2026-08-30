"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Zap,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Send,
  Code2,
  ShieldCheck,
  RotateCcw,
} from "lucide-react"
import { toast } from "sonner"

interface WebhookTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  webhook: {
    id: string
    name: string
    url: string
    events: string[]
  } | null
}

export function WebhookTestDialog({
  open,
  onOpenChange,
  tenantSlug,
  webhook,
}: WebhookTestDialogProps) {
  const [selectedEvent, setSelectedEvent] = useState<string>("content.created")
  const [customPayload, setCustomPayload] = useState<string>("")
  const [sending, setSending] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)

  // Initialize payload sample when event changes
  const resetPayloadSample = (eventKey: string) => {
    const sample = {
      event: eventKey,
      timestamp: new Date().toISOString(),
      tenant: {
        slug: tenantSlug,
      },
      data: {
        id: "test_entry_001",
        contentType: "articles",
        title: "Judul Berita Uji Coba Webhook SaCMS",
        slug: "judul-berita-uji-coba-webhook",
        status: "PUBLISHED",
        locale: "id",
        author: "Admin SaCMS",
      },
    }
    setCustomPayload(JSON.stringify(sample, null, 2))
    setTestResult(null)
  }

  // Handle send test dispatch
  const handleSendTest = async () => {
    if (!webhook) return

    let parsedPayload: any = null
    try {
      if (customPayload.trim()) {
        parsedPayload = JSON.parse(customPayload)
      }
    } catch {
      toast.error("Format JSON Payload tidak valid. Periksa tanda koma atau kurung kurawal.")
      return
    }

    setSending(true)
    setTestResult(null)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/webhooks/${webhook.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: selectedEvent,
          customPayload: parsedPayload,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Gagal menjalankan dispatch webhook")
      }

      setTestResult(data)
      if (data.success) {
        toast.success(`Dispatch Berhasil (${data.statusCode})`, {
          description: `Endpoint merespons dalam ${data.durationMs}ms`,
        })
      } else {
        toast.error(`Dispatch Gagal (${data.statusCode || "Error"})`, {
          description: data.errorMessage || data.statusText,
        })
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal melakukan uji coba webhook")
      setTestResult({
        success: false,
        statusCode: 0,
        statusText: "Error",
        errorMessage: err.message,
      })
    } finally {
      setSending(false)
    }
  }

  if (!webhook) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-2xl gap-0 border-border/80 bg-card">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Uji Coba Webhook: {webhook.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 font-mono truncate max-w-md">
                  POST {webhook.url}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[500px] overflow-y-auto">
          {/* Event Picker */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Tipe Event</Label>
              <Select
                value={selectedEvent}
                onValueChange={(val) => {
                  setSelectedEvent(val)
                  resetPayloadSample(val)
                }}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl bg-background border-border/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  <SelectItem value="content.created" className="text-xs">content.created</SelectItem>
                  <SelectItem value="content.updated" className="text-xs">content.updated</SelectItem>
                  <SelectItem value="content.deleted" className="text-xs">content.deleted</SelectItem>
                  <SelectItem value="content.published" className="text-xs">content.published</SelectItem>
                  <SelectItem value="media.uploaded" className="text-xs">media.uploaded</SelectItem>
                  <SelectItem value="media.deleted" className="text-xs">media.deleted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex flex-col justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resetPayloadSample(selectedEvent)}
                className="h-9 text-xs rounded-xl border-border/80"
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset Sample JSON
              </Button>
            </div>
          </div>

          {/* JSON Payload Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-primary" />
                Mock Request Payload (JSON)
              </Label>
              <span className="text-[10px] text-muted-foreground">Termasuk header signature HMAC SHA-256</span>
            </div>
            <Textarea
              value={customPayload || JSON.stringify({
                event: selectedEvent,
                timestamp: new Date().toISOString(),
                data: { id: "test_entry_001", title: "Uji Coba SaCMS Webhook" }
              }, null, 2)}
              onChange={(e) => setCustomPayload(e.target.value)}
              rows={7}
              className="font-mono text-xs rounded-xl bg-background border-border/80 resize-y"
            />
          </div>

          {/* Live Test Response Inspector */}
          {testResult && (
            <div className="rounded-xl border border-border/80 overflow-hidden bg-muted/10 space-y-2 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-rose-500" />
                  )}
                  Hasil Dispatch
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] font-bold ${
                      testResult.statusCode >= 200 && testResult.statusCode < 300
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                    }`}
                  >
                    HTTP {testResult.statusCode || "ERR"} {testResult.statusText}
                  </Badge>
                  {testResult.durationMs !== undefined && (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      <Clock className="h-2.5 w-2.5 mr-1" />
                      {testResult.durationMs}ms
                    </Badge>
                  )}
                </div>
              </div>

              {testResult.errorMessage && (
                <p className="text-rose-600 dark:text-rose-400 text-[11px] font-medium">
                  {testResult.errorMessage}
                </p>
              )}

              {testResult.responseBody && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Response Body:</span>
                  <pre className="p-2.5 rounded-lg bg-background border border-border/60 text-[11px] font-mono overflow-x-auto max-h-28">
                    {testResult.responseBody}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex justify-between gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 text-xs rounded-xl"
          >
            Tutup
          </Button>
          <Button
            onClick={handleSendTest}
            disabled={sending}
            className="h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow-xs"
          >
            {sending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-3.5 w-3.5" />
            )}
            Kirim Payload Uji Coba
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
