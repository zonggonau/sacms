"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Loader2,
  Save,
  Building2,
  Globe,
  Database,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"

export default function TenantSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Tenant settings state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [plan, setPlan] = useState("free")
  const [tenantStatus, setTenantStatus] = useState("active")

  // API settings
  const [apiVersion, setApiVersion] = useState("v1")
  const [rateLimiting, setRateLimiting] = useState(true)
  const [requestsPerMinute, setRequestsPerMinute] = useState("60")
  const [burstLimit, setBurstLimit] = useState("100")
  const [corsOrigins, setCorsOrigins] = useState("")

  // Security settings
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [ipWhitelist, setIpWhitelist] = useState(false)
  const [allowedIps, setAllowedIps] = useState("")
  const [auditLogging, setAuditLogging] = useState(true)

  const tenants = useMemo(() => {
    return session?.user?.tenants || []
  }, [session])

  const currentTenant = useMemo(() => {
    return tenants.find((t) => t.slug === tenantSlug)
  }, [tenants, tenantSlug])

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

        // Fetch tenant settings
        const settingsRes = await fetch(`/api/tenant/${tenantSlug}/settings`)
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          const settings = data.settings
          setName(settings.name || "")
          setDescription(settings.description || "")
          setPlan(settings.plan || "free")
          setTenantStatus(settings.status || "active")
          setApiVersion(settings.apiVersion || "v1")
          setRateLimiting(settings.rateLimiting ?? true)
          setRequestsPerMinute(String(settings.requestsPerMinute || 60))
          setBurstLimit(String(settings.burstLimit || 100))
          setCorsOrigins(settings.corsOrigins || "")
          setTwoFactorRequired(settings.twoFactorRequired ?? false)
          setIpWhitelist(settings.ipWhitelist ?? false)
          setAllowedIps(settings.allowedIps || "")
          setAuditLogging(settings.auditLogging ?? true)
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

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          apiVersion,
          rateLimiting,
          requestsPerMinute: parseInt(requestsPerMinute),
          burstLimit: parseInt(burstLimit),
          corsOrigins,
          twoFactorRequired,
          ipWhitelist,
          allowedIps,
          auditLogging,
        }),
      })

      if (res.ok) {
        alert("Settings saved successfully!")
      } else {
        const data = await res.json()
        alert(data.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Failed to save:", error)
      alert("Failed to save settings")
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/export`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${tenantSlug}-export-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert("Failed to export data")
      }
    } catch (error) {
      console.error("Export failed:", error)
      alert("Failed to export data")
    }
  }

  const handleDeleteContent = async () => {
    if (!confirm("Are you sure you want to delete all content? This cannot be undone.")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content`, {
        method: "DELETE",
      })

      if (res.ok) {
        alert("All content deleted successfully")
      } else {
        alert("Failed to delete content")
      }
    } catch (error) {
      console.error("Delete failed:", error)
      alert("Failed to delete content")
    }
  }

  const handleDeleteWorkspace = async () => {
    if (deleteConfirm !== tenantSlug) {
      alert("Please type the workspace URL to confirm deletion")
      return
    }

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}`, {
        method: "DELETE",
      })

      if (res.ok) {
        router.push("/dashboard")
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete workspace")
      }
    } catch (error) {
      console.error("Delete failed:", error)
      alert("Failed to delete workspace")
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
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Manage your workspace settings
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className="capitalize">{plan}</Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={tenantStatus === "active" ? "default" : "secondary"} className="capitalize">
                  {tenantStatus}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Content Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{contentTypes.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Your Role
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className="capitalize">
                  {currentTenant?.role || "member"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Settings Tabs */}
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList>
              <TabsTrigger value="general">
                <Building2 className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="api">
                <Globe className="h-4 w-4 mr-2" />
                API
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="danger">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Danger Zone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>Workspace Settings</CardTitle>
                  <CardDescription>
                    Configure your workspace settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="workspace-name">Workspace Name</Label>
                      <Input
                        id="workspace-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workspace-slug">Workspace URL</Label>
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                          sacms.io/
                        </span>
                        <Input
                          id="workspace-slug"
                          value={tenantSlug}
                          disabled
                          className="rounded-l-none bg-muted"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        URL slug cannot be changed after creation
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="workspace-description">Description</Label>
                    <Textarea
                      id="workspace-description"
                      placeholder="Describe your workspace..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Plan</Label>
                      <Select value={plan} onValueChange={setPlan} disabled>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="free">Free</SelectItem>
                          <SelectItem value="starter">Starter</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Upgrade your plan in billing settings
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <div className="flex items-center gap-2">
                        <Badge variant={tenantStatus === "active" ? "default" : "secondary"}>
                          {tenantStatus}
                        </Badge>
                        {tenantStatus === "active" && <CheckCircle className="h-4 w-4 text-green-500" />}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api">
              <Card>
                <CardHeader>
                  <CardTitle>API Configuration</CardTitle>
                  <CardDescription>
                    Configure API settings for your workspace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>API Version</Label>
                    <Select value={apiVersion} onValueChange={setApiVersion}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="v1">v1 (Stable)</SelectItem>
                        <SelectItem value="v2">v2 (Beta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Rate Limiting</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable rate limiting for API requests
                      </p>
                    </div>
                    <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
                  </div>
                  {rateLimiting && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Requests per minute</Label>
                        <Input
                          type="number"
                          value={requestsPerMinute}
                          onChange={(e) => setRequestsPerMinute(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Burst limit</Label>
                        <Input
                          type="number"
                          value={burstLimit}
                          onChange={(e) => setBurstLimit(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <Separator />
                  <div className="space-y-2">
                    <Label>Allowed Origins (CORS)</Label>
                    <Textarea
                      placeholder="Enter allowed origins, one per line&#10;https://example.com&#10;https://app.example.com"
                      rows={4}
                      value={corsOrigins}
                      onChange={(e) => setCorsOrigins(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter domain names, one per line. Use * for all origins (not recommended for production)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Settings</CardTitle>
                  <CardDescription>
                    Configure security settings for your workspace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">
                        Require 2FA for all team members
                      </p>
                    </div>
                    <Switch checked={twoFactorRequired} onCheckedChange={setTwoFactorRequired} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>IP Whitelist</Label>
                      <p className="text-sm text-muted-foreground">
                        Restrict access to specific IP addresses
                      </p>
                    </div>
                    <Switch checked={ipWhitelist} onCheckedChange={setIpWhitelist} />
                  </div>
                  {ipWhitelist && (
                    <div className="space-y-2">
                      <Label>Allowed IP Addresses</Label>
                      <Textarea
                        placeholder="Enter IP addresses, one per line&#10;192.168.1.1&#10;10.0.0.0/24"
                        rows={4}
                        value={allowedIps}
                        onChange={(e) => setAllowedIps(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Supports individual IPs and CIDR notation
                      </p>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Audit Logging</Label>
                      <p className="text-sm text-muted-foreground">
                        Log all API requests and content changes
                      </p>
                    </div>
                    <Switch checked={auditLogging} onCheckedChange={setAuditLogging} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="danger">
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                  <CardDescription>
                    Irreversible and destructive actions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Export Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Download all your content and settings
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">Delete All Content</h4>
                      <p className="text-sm text-muted-foreground">
                        Delete all content entries but keep content types
                      </p>
                    </div>
                    <Button variant="destructive" onClick={handleDeleteContent}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Content
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border border-destructive rounded-lg bg-destructive/5">
                    <div>
                      <h4 className="font-medium text-destructive">Delete Workspace</h4>
                      <p className="text-sm text-muted-foreground">
                        Permanently delete this workspace and all data
                      </p>
                    </div>
                    <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Button */}
          <div className="flex justify-end mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>

          {/* Delete Workspace Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Workspace</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. This will permanently delete your workspace
                  and all associated data including content, media, and settings.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    Type <code className="bg-muted px-1 rounded">{tenantSlug}</code> to confirm
                  </p>
                </div>
                <Input
                  placeholder={`Type ${tenantSlug} to confirm`}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteWorkspace}
                  disabled={deleteConfirm !== tenantSlug}
                >
                  Delete Workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
