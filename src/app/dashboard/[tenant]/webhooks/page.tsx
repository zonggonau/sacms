"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"

interface WebhookType {
  id: string
  name: string
  url: string
  events: string[]
  enabled: boolean
  lastTriggeredAt: string | null
  failureCount: number
  createdAt: string
}

const availableEvents = [
  { id: "content.created", label: "Content Created", description: "When a new entry is created" },
  { id: "content.updated", label: "Content Updated", description: "When an entry is updated" },
  { id: "content.deleted", label: "Content Deleted", description: "When an entry is deleted" },
  { id: "content.published", label: "Content Published", description: "When an entry is published" },
  { id: "content.unpublished", label: "Content Unpublished", description: "When an entry is unpublished" },
  { id: "media.uploaded", label: "Media Uploaded", description: "When a file is uploaded" },
  { id: "media.deleted", label: "Media Deleted", description: "When a file is deleted" },
]

export default function WebhooksPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<WebhookType | null>(null)
  const [showLogs, setShowLogs] = useState(false)
  const [selectedWebhookLogs, setSelectedWebhookLogs] = useState<Array<{
    id: string
    event: string
    success: boolean
    statusCode: number | null
    duration: number | null
    error: string | null
    createdAt: string
  }>>([])

  // Form state
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")
  const [secret, setSecret] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [enabled, setEnabled] = useState(true)

  const tenants = useMemo(() => {
    return session?.user?.tenants || []
  }, [session])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      if (!tenantSlug || !session?.user) return

      try {
        // Fetch content types for sidebar
        const ctRes = await fetch(`/api/tenant/${tenantSlug}/content-types`)
        if (ctRes.ok) {
          const data = await ctRes.json()
          setContentTypes(data.contentTypes || [])
        }

        // Fetch webhooks
        const whRes = await fetch(`/api/tenant/${tenantSlug}/webhooks`)
        if (whRes.ok) {
          const data = await whRes.json()
          setWebhooks(data.webhooks || [])
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchData()
    }
  }, [tenantSlug, session])

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

  const handleSave = async () => {
    if (!name || !url || selectedEvents.length === 0) {
      alert("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const method = editingWebhook ? "PUT" : "POST"
      const endpoint = editingWebhook
        ? `/api/tenant/${tenantSlug}/webhooks/${editingWebhook.id}`
        : `/api/tenant/${tenantSlug}/webhooks`

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          secret: secret || undefined,
          events: selectedEvents,
          enabled,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (editingWebhook) {
          setWebhooks(webhooks.map((w) => (w.id === editingWebhook.id ? data.webhook : w)))
        } else {
          setWebhooks([...webhooks, data.webhook])
        }
        setShowDialog(false)
        resetForm()
      } else {
        const data = await res.json()
        alert(data.error || "Failed to save webhook")
      }
    } catch (error) {
      console.error("Failed to save:", error)
      alert("Failed to save webhook")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (webhookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/webhooks/${webhookId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== webhookId))
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete webhook")
      }
    } catch (error) {
      console.error("Failed to delete:", error)
      alert("Failed to delete webhook")
    }
  }

  const handleToggleEnabled = async (webhook: WebhookType) => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      })

      if (res.ok) {
        setWebhooks(webhooks.map((w) =>
          w.id === webhook.id ? { ...w, enabled: !w.enabled } : w
        ))
      }
    } catch (error) {
      console.error("Failed to toggle:", error)
    }
  }

  const handleViewLogs = async (webhookId: string) => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/webhooks/${webhookId}/logs`)
      if (res.ok) {
        const data = await res.json()
        setSelectedWebhookLogs(data.logs || [])
        setShowLogs(true)
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Webhooks</h1>
              <p className="text-muted-foreground">
                Configure webhooks for real-time event notifications
              </p>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Webhook
            </Button>
          </div>

          {/* Info Card */}
          <Card className="mb-6 bg-muted/50">
            <CardContent className="flex items-start gap-4 p-4">
              <Webhook className="h-8 w-8 text-muted-foreground flex-shrink-0" />
              <div>
                <h3 className="font-semibold">What are Webhooks?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Webhooks allow external services to be notified when events happen in your workspace.
                  When an event occurs, we&apos;ll send a POST request to your configured URL with the event data.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Webhooks Table */}
          {webhooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No webhooks configured</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create a webhook to receive real-time notifications
                </p>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Webhook
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Your Webhooks</CardTitle>
                <CardDescription>
                  Manage webhooks for event notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Triggered</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {webhooks.map((webhook) => (
                      <TableRow key={webhook.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Webhook className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{webhook.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {webhook.url.length > 40 ? webhook.url.substring(0, 40) + "..." : webhook.url}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {webhook.events.slice(0, 2).map((event) => (
                              <Badge key={event} variant="outline" className="text-xs">
                                {event.split(".")[1]}
                              </Badge>
                            ))}
                            {webhook.events.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{webhook.events.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.enabled}
                              onCheckedChange={() => handleToggleEnabled(webhook)}
                            />
                            {webhook.failureCount > 0 && (
                              <Badge variant="destructive" className="text-xs">
                                {webhook.failureCount} failures
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {webhook.lastTriggeredAt
                            ? new Date(webhook.lastTriggeredAt).toLocaleString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewLogs(webhook.id)}
                              title="View logs"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenEdit(webhook)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingWebhook ? "Edit Webhook" : "Create Webhook"}
                </DialogTitle>
                <DialogDescription>
                  Configure webhook settings and event subscriptions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Slack Notifications"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="url">Webhook URL</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://your-service.com/webhook"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      The URL where we&apos;ll send POST requests for events
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret">Secret (Optional)</Label>
                    <Input
                      id="secret"
                      type="password"
                      placeholder="Your signing secret"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used to sign payloads with HMAC-SHA256 for verification
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Events */}
                <div className="space-y-4">
                  <Label>Events to Subscribe</Label>
                  <div className="grid gap-2">
                    {availableEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedEvents.includes(event.id)
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                        onClick={() => handleToggleEvent(event.id)}
                      >
                        <div>
                          <p className="font-medium text-sm">{event.label}</p>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                        <Switch
                          checked={selectedEvents.includes(event.id)}
                          onCheckedChange={() => handleToggleEvent(event.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Enabled */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Webhook</p>
                    <p className="text-sm text-muted-foreground">
                      Webhook will receive events when enabled
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingWebhook ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Logs Dialog */}
          <Dialog open={showLogs} onOpenChange={setShowLogs}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Webhook Logs</DialogTitle>
                <DialogDescription>
                  Recent webhook delivery attempts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {selectedWebhookLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <p>No logs yet</p>
                  </div>
                ) : (
                  selectedWebhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${
                        log.success ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="font-medium text-sm">{log.event}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {log.statusCode && (
                          <span>Status: {log.statusCode}</span>
                        )}
                        {log.duration && (
                          <span>Duration: {log.duration}ms</span>
                        )}
                      </div>
                      {log.error && (
                        <p className="text-xs text-red-500 mt-2">{log.error}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
