"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  Webhook,
  Plus,
  Trash2,
  Edit,
  Zap,
  History,
} from "lucide-react"
import { WebhookLogsDialog } from "@/components/cms/webhook-logs-dialog"
import { WebhookTestDialog } from "@/components/developer/webhook-test-dialog"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { createWebhookAction, updateWebhookAction, deleteWebhookAction } from "@/actions/webhooks"

interface WebhookType {
  id: string
  name: string
  url: string
  events: string[]
  enabled: boolean
  lastTriggeredAt: Date | string | null
  failureCount: number
  createdAt: Date | string
}

interface WebhooksClientProps {
  initialWebhooks: WebhookType[]
  tenantSlug: string
}

const availableEvents = [
  { id: "content.created", label: "Konten Dibuat (content.created)", description: "Dipicu saat entri konten baru tersimpan" },
  { id: "content.updated", label: "Konten Diperbarui (content.updated)", description: "Dipicu saat data entri konten diedit" },
  { id: "content.deleted", label: "Konten Dihapus (content.deleted)", description: "Dipicu saat entri konten dihapus" },
  { id: "content.published", label: "Konten Dipublikasikan (content.published)", description: "Dipicu saat status entri beralih ke PUBLISHED" },
  { id: "content.unpublished", label: "Konten Di-unpublish (content.unpublished)", description: "Dipicu saat status publikasi ditarik kembali" },
  { id: "media.uploaded", label: "Media Diunggah (media.uploaded)", description: "Dipicu saat berkas media baru berhasil disimpan" },
  { id: "media.deleted", label: "Media Dihapus (media.deleted)", description: "Dipicu saat berkas media dihapus dari storage" },
]

export function WebhooksClient({ initialWebhooks, tenantSlug }: WebhooksClientProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [isPending, startTransition] = useTransition()
  
  const [showDialog, setShowDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null)
  const [logsDialog, setLogsDialog] = useState<{ open: boolean; webhookId: string; webhookName: string }>({
    open: false,
    webhookId: "",
    webhookName: "",
  })
  const [testDialog, setTestDialog] = useState<{ open: boolean; webhook: WebhookType | null }>({
    open: false,
    webhook: null,
  })

  // Form state
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [enabled, setEnabled] = useState(true)

  const resetForm = () => {
    setName("")
    setUrl("")
    setSecret("")
    setSelectedEvents([])
    setEnabled(true)
    setEditingWebhook(null)
  }

  const handleOpenCreate = () => {
    resetForm()
    setShowDialog(true)
  }

  const handleOpenEdit = (webhook: WebhookType) => {
    setEditingWebhook(webhook)
    setName(webhook.name)
    setUrl(webhook.url)
    setSelectedEvents(webhook.events)
    setEnabled(webhook.enabled)
    setShowDialog(true)
  }

  const handleToggleEvent = (eventId: string) => {
    setSelectedEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    )
  }

  const handleToggleEnabled = (webhook: WebhookType) => {
    startTransition(async () => {
      const res = await updateWebhookAction(tenantSlug, webhook.id, {
        enabled: !webhook.enabled,
      })
      if (res.error) {
        toast({ variant: "destructive", title: "Terjadi Kesalahan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: `Webhook ${!webhook.enabled ? "diaktifkan" : "dinonaktifkan"}` })
      }
    })
  }

  const handleViewLogs = (webhook: WebhookType) => {
    setLogsDialog({
      open: true,
      webhookId: webhook.id,
      webhookName: webhook.name,
    })
  }

  const handleSave = () => {
    if (!name || !url || selectedEvents.length === 0) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Lengkapi semua field wajib dan pilih minimal satu event" })
      return
    }

    startTransition(async () => {
      const payload: any = {
        name,
        url,
        secret: secret || undefined,
        events: selectedEvents,
        enabled,
        hookType: "async",
      }

      let res
      if (editingWebhook) {
        res = await updateWebhookAction(tenantSlug, editingWebhook.id, payload)
      } else {
        res = await createWebhookAction(tenantSlug, payload)
      }

      if (res.error) {
        toast({ variant: "destructive", title: "Terjadi Kesalahan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: `Webhook berhasil ${editingWebhook ? "diperbarui" : "dibuat"}` })
        setShowDialog(false)
        resetForm()
      }
    })
  }

  const handleDelete = async (webhookId: string) => {
    if (
      !(await confirm({
        title: "Hapus webhook ini?",
        description: "Notifikasi ke URL eksternal ini akan berhenti.",
        confirmLabel: "Hapus webhook",
        variant: "destructive",
      }))
    )
      return

    startTransition(async () => {
      const res = await deleteWebhookAction(tenantSlug, webhookId)
      if (res.error) {
        toast({ variant: "destructive", title: "Terjadi Kesalahan", description: res.error })
      } else {
        toast({ title: "Berhasil", description: "Webhook berhasil dihapus" })
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">Webhooks & Integrasi Event</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Konfigurasi notifikasi HTTP POST otomatis ke URL eksternal saat konten atau media berubah.
              </p>
            </div>
            <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs">
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Webhook
            </Button>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-muted/30 border border-border/80 rounded-2xl flex items-center gap-3 text-xs text-muted-foreground shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <Webhook className="h-4 w-4" />
            </div>
            <p className="leading-relaxed">
              Webhook mengirimkan payload JSON real-time ke endpoint server Anda (seperti Vercel, CI/CD deploy hooks, atau Slack) saat ada mutasi data di workspace ini.
            </p>
          </div>

          {/* Webhooks Table */}
          {initialWebhooks.length === 0 ? (
            <Card className="border border-border/80 shadow-xs rounded-2xl bg-card">
              <CardContent className="py-16 text-center">
                <Zap className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="font-bold text-xs text-foreground mb-0.5">Belum ada webhook yang dikonfigurasi</p>
                <p className="text-[11px] text-muted-foreground mb-4">
                  Buat webhook untuk mulai menerima notifikasi event secara instan.
                </p>
                <Button onClick={handleOpenCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border/80 shadow-xs rounded-2xl bg-card overflow-hidden">
              <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-sm font-bold text-foreground">Daftar Webhook Terdaftar</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Pantau status pengiriman webhook dan riwayat pengiriman event.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border/60">
                    <TableRow>
                      <TableHead className="font-bold text-xs pl-6">Nama Webhook</TableHead>
                      <TableHead className="font-bold text-xs">URL Endpoint</TableHead>
                      <TableHead className="font-bold text-xs">Event Terpilih</TableHead>
                      <TableHead className="font-bold text-xs">Status</TableHead>
                      <TableHead className="font-bold text-xs">Terakhir Dipicu</TableHead>
                      <TableHead className="text-right pr-6 font-bold text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialWebhooks.map((webhook) => (
                      <TableRow key={webhook.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                        <TableCell className="pl-6 py-3">
                          <div className="flex items-center gap-2">
                            <Webhook className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-bold text-foreground">{webhook.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <code className="text-xs bg-muted/60 font-mono px-2 py-0.5 rounded-lg border border-border/60 text-foreground">
                            {webhook.url.length > 40 ? webhook.url.substring(0, 40) + "..." : webhook.url}
                          </code>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.slice(0, 2).map((event) => (
                              <Badge key={event} variant="outline" className="text-[10px] font-bold rounded-md bg-muted/30">
                                {event.split(".")[1]}
                              </Badge>
                            ))}
                            {webhook.events.length > 2 && (
                              <Badge variant="outline" className="text-[10px] font-bold rounded-md bg-muted/30">
                                +{webhook.events.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.enabled}
                              onCheckedChange={() => handleToggleEnabled(webhook)}
                              disabled={isPending}
                            />
                            {webhook.failureCount > 0 && (
                              <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                {webhook.failureCount} gagal
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground py-3">
                          {webhook.lastTriggeredAt
                            ? new Date(webhook.lastTriggeredAt).toLocaleString("id-ID")
                            : "Belum Pernah"}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                              onClick={() => setTestDialog({ open: true, webhook })}
                              title="Uji Coba Webhook (Test Dispatch)"
                            >
                              <Zap className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              onClick={() => handleViewLogs(webhook)}
                              title="Lihat Log Pengiriman"
                            >
                              <History className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEdit(webhook)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(webhook.id)}
                              disabled={isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Create/Edit Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border-border/80 bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground">
                  {editingWebhook ? "Edit Webhook" : "Buat Webhook Baru"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Konfigurasikan URL penerima dan event yang ingin dilanggan.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {/* Basic Info */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-semibold text-foreground">Nama Webhook</Label>
                    <Input
                      id="name"
                      placeholder="Contoh: Deploy Hook Vercel"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="url" className="text-xs font-semibold text-foreground">Target URL Webhook</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://api.domainanda.com/webhooks/sacms"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      URL tujuan yang akan menerima HTTP POST request saat event terpicu.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="secret" className="text-xs font-semibold text-foreground">Signing Secret (Opsional)</Label>
                    <Input
                      id="secret"
                      type="password"
                      placeholder="Secret key untuk verifikasi payload HMAC-SHA256"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      className="rounded-xl h-9 text-xs bg-background border-border/80"
                    />
                  </div>
                </div>

                <Separator className="bg-border/60" />

                {/* Events */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold text-foreground">Langganan Event</Label>
                  <div className="grid gap-2">
                    {availableEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors cursor-pointer ${
                          selectedEvents.includes(event.id)
                            ? "border-primary bg-primary/5"
                            : "border-border/80 bg-muted/20 hover:border-border"
                        }`}
                        onClick={() => handleToggleEvent(event.id)}
                      >
                        <div>
                          <p className="font-bold text-xs text-foreground">{event.label}</p>
                          <p className="text-[10px] text-muted-foreground">{event.description}</p>
                        </div>
                        <Switch
                          checked={selectedEvents.includes(event.id)}
                          onCheckedChange={() => handleToggleEvent(event.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-border/60" />

                {/* Enabled */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-muted/20 border border-border/60">
                  <div>
                    <p className="font-bold text-xs text-foreground">Status Aktif</p>
                    <p className="text-[10px] text-muted-foreground">
                      Webhook hanya akan mengirim event jika opsi ini diaktifkan.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button variant="outline" onClick={() => setShowDialog(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">
                  Batal
                </Button>
                <Button onClick={handleSave} disabled={isPending} className="rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground">
                  {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editingWebhook ? "Simpan Perubahan" : "Buat Webhook"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <WebhookLogsDialog 
        tenantSlug={tenantSlug}
        webhookId={logsDialog.webhookId}
        webhookName={logsDialog.webhookName}
        open={logsDialog.open}
        onOpenChange={(open) => setLogsDialog(prev => ({ ...prev, open }))}
      />

      <WebhookTestDialog
        tenantSlug={tenantSlug}
        webhook={testDialog.webhook}
        open={testDialog.open}
        onOpenChange={(open) => setTestDialog(prev => ({ ...prev, open }))}
      />
    </div>
  )
}
