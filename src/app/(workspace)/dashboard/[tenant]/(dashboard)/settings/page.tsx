"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"
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
  Database,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Server,
  Mail,
  Upload,
  Layers,
  UserCheck,
  Zap,
} from "lucide-react"
import { toast } from "sonner"
import { UsageTab } from "@/components/dashboard/usage-tab"
import { getContentTypesAction } from "@/actions/content-types"

export default function TenantSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const tenantSlug = params?.tenant as string

  const defaultTabParam = searchParams?.get("tab") || "general"
  const [activeTab, setActiveTab] = useState(defaultTabParam)

  useEffect(() => {
    const tab = searchParams?.get("tab")
    if (tab) setActiveTab(tab)
  }, [searchParams])

  const [contentTypes, setContentTypes] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")

  // Tenant settings state
  const [tenantId, setTenantId] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [plan, setPlan] = useState("free")
  const [tenantStatus, setTenantStatus] = useState("active")
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)

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
  const [isEnterprise, setIsEnterprise] = useState(false)

  // Infrastructure settings
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [storageEndpoint, setStorageEndpoint] = useState("")
  const [storageAccessKey, setStorageAccessKey] = useState("")
  const [storageSecretKey, setStorageSecretKey] = useState("")
  const [storageBucket, setStorageBucket] = useState("")
  const [storagePublicUrl, setStoragePublicUrl] = useState("")

  // Email settings
  const [smtpHost, setSmtpHost] = useState("")
  const [smtpPort, setSmtpPort] = useState("")
  const [smtpUser, setSmtpUser] = useState("")
  const [smtpPassword, setSmtpPassword] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [fromName, setFromName] = useState("")

  const tenants = useMemo(() => {
    return session?.user?.tenants || []
  }, [session])

  const currentTenant = useMemo(() => {
    return tenants.find((t) => t.slug === tenantSlug || t.id === tenantSlug)
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
        const ctData = await getContentTypesAction(tenantSlug)
        if (ctData && !ctData.error) {
          setContentTypes(ctData.contentTypes || [])
        }

        const settingsRes = await fetch(`/api/tenant/${tenantSlug}/settings`)
        if (settingsRes.ok) {
          const data = await settingsRes.json()
          const settings = data.settings
          setTenantId(settings.id || "")
          setName(settings.name || "")
          setDescription(settings.description || "")
          setPlan(settings.plan || "free")
          setTenantStatus(settings.status || "active")
          setSubscriptionStatus(settings.subscriptionStatus || null)
          setDaysRemaining(settings.daysRemaining ?? null)
          setApiVersion(settings.apiVersion || "v1")
          setRateLimiting(settings.rateLimiting ?? true)
          setRequestsPerMinute(String(settings.requestsPerMinute || 60))
          setBurstLimit(String(settings.burstLimit || 100))
          setCorsOrigins(settings.corsOrigins || "")
          setTwoFactorRequired(settings.twoFactorRequired || false)
          setIpWhitelist(settings.ipWhitelist || false)
          setAllowedIps(settings.allowedIps || "")
          setAuditLogging(settings.auditLogging ?? true)
          setIsEnterprise(settings.isEnterprise || false)
          setDatabaseUrl(settings.databaseUrl || "")
          
          if (settings.storageConfig) {
            setStorageEndpoint(settings.storageConfig.endpoint || "")
            setStorageAccessKey(settings.storageConfig.accessKey || "")
            setStorageSecretKey(settings.storageConfig.secretKey || "")
            setStorageBucket(settings.storageConfig.bucket || "")
            setStoragePublicUrl(settings.storageConfig.publicUrl || "")
          }

          setSmtpHost(settings.smtpHost || "")
          setSmtpPort(settings.smtpPort || "")
          setSmtpUser(settings.smtpUser || "")
          setSmtpPassword(settings.smtpPassword || "")
          setFromEmail(settings.fromEmail || "")
          setFromName(settings.fromName || "")
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error)
        toast.error("Gagal memuat pengaturan workspace")
      } finally {
        setLoading(false)
      }
    }

    if (tenantSlug && session?.user) {
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
          requestsPerMinute: parseInt(requestsPerMinute) || 60,
          burstLimit: parseInt(burstLimit) || 100,
          corsOrigins,
          twoFactorRequired,
          ipWhitelist,
          allowedIps,
          auditLogging,
          databaseUrl,
          smtpHost,
          smtpPort,
          smtpUser,
          smtpPassword,
          fromEmail,
          fromName,
          storageConfig: storageEndpoint && storageAccessKey && storageSecretKey && storageBucket ? {
            endpoint: storageEndpoint,
            accessKey: storageAccessKey,
            secretKey: storageSecretKey,
            bucket: storageBucket,
            publicUrl: storagePublicUrl,
          } : null,
        }),
      })

      if (res.ok) {
        toast.success("Pengaturan workspace berhasil disimpan!")
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal menyimpan pengaturan")
      }
    } catch (error) {
      console.error("Failed to save:", error)
      toast.error("Terjadi kesalahan saat menyimpan pengaturan")
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
        toast.success("Data workspace berhasil diekspor!")
      } else {
        toast.error("Gagal mengekspor data workspace")
      }
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Terjadi kesalahan saat ekspor data")
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm("Apakah Anda yakin ingin mengimpor berkas konfigurasi ini?")) return
    
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/tenant/${tenantSlug}/import`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast.success("Data berhasil diimpor! Halaman akan dimuat ulang.")
        setTimeout(() => window.location.reload(), 1000)
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal mengimpor data")
      }
    } catch (error) {
      console.error("Import failed:", error)
      toast.error("Terjadi kesalahan saat impor data")
    } finally {
      setSaving(false)
      e.target.value = ""
    }
  }

  const handleDeleteContent = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus SEMUA entri konten? Tindakan ini tidak dapat dibatalkan.")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Seluruh entri konten berhasil dihapus")
      } else {
        toast.error("Gagal menghapus entri konten")
      }
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error("Gagal menghubungi server")
    }
  }

  const handleDeleteWorkspace = async () => {
    if (deleteConfirm !== tenantSlug) {
      toast.error("Silakan ketik slug workspace untuk konfirmasi penghapusan")
      return
    }

    if (!currentTenant?.id) {
      toast.error("ID workspace tidak ditemukan")
      return
    }

    try {
      const res = await fetch(`/api/tenants/${currentTenant.id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Workspace berhasil dihapus")
        window.location.href = "/dashboard"
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal menghapus workspace")
      }
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error("Terjadi kesalahan saat menghapus workspace")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  Pengaturan Workspace
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full uppercase">
                  {plan}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Kelola informasi umum workspace, kredensial SMTP email, kebijakan keamanan akun, dan konfigurasi infrastruktur.
              </p>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs shrink-0"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Perubahan
            </Button>
          </div>

          {/* Quick Overview Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Paket Layanan</p>
                <div className="text-xl font-black text-foreground capitalize flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  {plan}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Status Workspace</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {subscriptionStatus === "trialing" ? (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold rounded-full">
                      Trial {daysRemaining !== null ? `(${daysRemaining} Hari)` : ""}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> {tenantStatus}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Content Types</p>
                <div className="text-xl font-black text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  {contentTypes.length} Model
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Peran Anda</p>
                <div className="text-xl font-black text-foreground capitalize flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-primary" />
                  {currentTenant?.role || "Owner"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settings Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl flex flex-wrap max-w-full h-auto gap-1">
              <TabsTrigger value="general" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                General
              </TabsTrigger>

              <TabsTrigger value="email" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Email SMTP
              </TabsTrigger>

              <TabsTrigger value="security" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Keamanan
              </TabsTrigger>

              <TabsTrigger value="usage" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Penggunaan (Usage)
              </TabsTrigger>

              {isEnterprise && (
                <TabsTrigger value="infrastructure" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs">
                  <Server className="h-3.5 w-3.5 mr-1.5" />
                  Infrastruktur Dedicated
                </TabsTrigger>
              )}

              <TabsTrigger value="danger" className="rounded-xl font-bold text-xs py-2 data-[state=active]:bg-background data-[state=active]:shadow-xs text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Danger Zone
              </TabsTrigger>
            </TabsList>

            {/* TAB: GENERAL */}
            <TabsContent value="general" className="space-y-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Informasi Profil Workspace
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Nama dan deskripsi yang mengidentifikasi workspace ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="workspace-name" className="text-xs font-semibold text-foreground">Nama Workspace</Label>
                      <Input
                        id="workspace-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="workspace-slug" className="text-xs font-semibold text-foreground">Slug URL Workspace</Label>
                      <Input
                        id="workspace-slug"
                        value={tenantSlug}
                        disabled
                        className="rounded-xl h-9 text-xs bg-muted/40 font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Slug URL bersifat permanen untuk isolasi tenant.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="workspace-description" className="text-xs font-semibold text-foreground">Deskripsi Workspace</Label>
                    <Textarea
                      id="workspace-description"
                      placeholder="Jelaskan tujuan atau proyek dari workspace ini..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="rounded-xl text-xs bg-background border-border/80"
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Paket Langganan</Label>
                      <Select value={plan} onValueChange={setPlan} disabled>
                        <SelectTrigger className="rounded-xl h-9 text-xs bg-muted/40 border-border/80 capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="free" className="text-xs">Free</SelectItem>
                          <SelectItem value="starter" className="text-xs">Starter</SelectItem>
                          <SelectItem value="pro" className="text-xs">Pro</SelectItem>
                          <SelectItem value="enterprise" className="text-xs">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Kelola atau upgrade paket Anda di menu Billing.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Status Workspace</Label>
                      <div className="h-9 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-bold capitalize rounded-lg bg-primary/10 text-primary border-primary/20">
                          {tenantStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: EMAIL (SMTP) */}
            <TabsContent value="email" className="space-y-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    Konfigurasi Pengiriman Email (SMTP)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Gunakan server SMTP khusus untuk mengirimkan undangan anggota dan notifikasi workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpHost" className="text-xs font-semibold text-foreground">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.resend.com / smtp.mailgun.org"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPort" className="text-xs font-semibold text-foreground">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        placeholder="587 / 465"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpUser" className="text-xs font-semibold text-foreground">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        placeholder="apikey / user@domain.com"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPassword" className="text-xs font-semibold text-foreground">SMTP Password / API Key</Label>
                      <Input
                        id="smtpPassword"
                        type="password"
                        placeholder="••••••••••••"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fromEmail" className="text-xs font-semibold text-foreground">Default From Email</Label>
                      <Input
                        id="fromEmail"
                        placeholder="notifications@yourbrand.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fromName" className="text-xs font-semibold text-foreground">Default Sender Name</Label>
                      <Input
                        id="fromName"
                        placeholder="My Project Team"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: SECURITY */}
            <TabsContent value="security" className="space-y-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    Kebijakan Keamanan & Audit Log
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Atur autentikasi 2FA, pembatasan IP Whitelist, dan pencatatan audit perubahan konten.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Wajibkan Two-Factor Authentication (2FA)</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Mengharuskan seluruh anggota tim mengaktifkan 2FA saat login ke workspace ini.
                      </p>
                    </div>
                    <Switch checked={twoFactorRequired} onCheckedChange={setTwoFactorRequired} />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Pembatasan IP (IP Whitelist)</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Batasi akses dashboard dan API hanya dari rentang alamat IP tepercaya.
                        </p>
                      </div>
                      <Switch checked={ipWhitelist} onCheckedChange={setIpWhitelist} />
                    </div>

                    {ipWhitelist && (
                      <div className="space-y-1.5 pt-1">
                        <Label className="text-xs font-semibold text-foreground">Daftar IP yang Diizinkan</Label>
                        <Textarea
                          placeholder="Masukkan IP atau subnet CIDR per baris:&#10;103.120.10.1&#10;192.168.1.0/24"
                          rows={4}
                          value={allowedIps}
                          onChange={(e) => setAllowedIps(e.target.value)}
                          className="rounded-xl text-xs font-mono bg-background border-border/80"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Pencatatan Audit Log Lengkap</Label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Catat riwayat modifikasi skema, entri konten, dan aktivitas autentikasi anggota.
                      </p>
                    </div>
                    <Switch checked={auditLogging} onCheckedChange={setAuditLogging} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: USAGE */}
            <TabsContent value="usage" className="space-y-6">
              <UsageTab tenantSlug={tenantSlug} />
            </TabsContent>

            {/* TAB: INFRASTRUCTURE (Enterprise Mode) */}
            {isEnterprise && (
              <TabsContent value="infrastructure" className="space-y-6">
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Server className="h-4 w-4 text-primary" />
                      Bring Your Own Infrastructure (Dedicated)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Gunakan database PostgreSQL terdedikasi dan storage S3/R2 khusus untuk workspace ini.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="dbUrl" className="text-xs font-semibold text-foreground">PostgreSQL Connection URL Dedicated</Label>
                      <Input
                        id="dbUrl"
                        type="password"
                        placeholder="postgresql://user:pass@host:5432/dbname"
                        value={databaseUrl}
                        onChange={(e) => setDatabaseUrl(e.target.value)}
                        className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Semua entri konten dan skema workspace akan disimpan di database khusus ini.
                      </p>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label className="text-xs font-semibold text-foreground">Custom S3 / Cloudflare R2 Storage</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Endpoint URL</Label>
                          <Input
                            placeholder="https://s3.ap-southeast-1.amazonaws.com"
                            value={storageEndpoint}
                            onChange={(e) => setStorageEndpoint(e.target.value)}
                            className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Bucket Name</Label>
                          <Input
                            placeholder="my-workspace-media"
                            value={storageBucket}
                            onChange={(e) => setStorageBucket(e.target.value)}
                            className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Access Key ID</Label>
                          <Input
                            type="password"
                            value={storageAccessKey}
                            onChange={(e) => setStorageAccessKey(e.target.value)}
                            className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Secret Access Key</Label>
                          <Input
                            type="password"
                            value={storageSecretKey}
                            onChange={(e) => setStorageSecretKey(e.target.value)}
                            className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[11px] text-muted-foreground">Public CDN URL (Opsional)</Label>
                          <Input
                            placeholder="https://cdn.myworkspace.com"
                            value={storagePublicUrl}
                            onChange={(e) => setStoragePublicUrl(e.target.value)}
                            className="rounded-xl h-9 text-xs font-mono bg-background border-border/80"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* TAB: DANGER ZONE */}
            <TabsContent value="danger" className="space-y-6">
              <Card className="rounded-2xl border-destructive/40 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-destructive/20 bg-destructive/5">
                  <CardTitle className="text-sm font-bold text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Tindakan Berisiko Tinggi (Danger Zone)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Operasi berikut bersifat permanen dan memengaruhi seluruh data pada workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  
                  {/* Export & Import */}
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Ekspor & Impor Data Workspace</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Unduh salinan JSON skema dan konten atau pulihkan konfigurasi dari berkas ekspor.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleExport} className="rounded-xl h-8 text-xs font-bold border-border/80">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Ekspor JSON
                      </Button>
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept=".json"
                          onChange={handleImport}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          disabled={saving}
                        />
                        <Button variant="outline" size="sm" disabled={saving} className="rounded-xl h-8 text-xs font-bold border-border/80">
                          <Upload className="mr-1.5 h-3.5 w-3.5" /> Impor
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Delete All Content */}
                  <div className="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Kosongkan Seluruh Entri Konten</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Hapus semua entri konten dari database tetapi tetap pertahankan model Content Type.
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDeleteContent}
                      className="rounded-xl h-8 text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Kosongkan Konten
                    </Button>
                  </div>

                  {/* Delete Entire Workspace */}
                  <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-destructive">Hapus Workspace Secara Permanen</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Menghapus permanen seluruh data, skema, media, token, dan riwayat webhook.
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                      className="rounded-xl h-8 text-xs font-bold"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Workspace
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Bottom Save Action Bar */}
          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Simpan Perubahan
            </Button>
          </div>

          {/* Delete Workspace Confirmation Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
              <DialogHeader>
                <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center mb-1">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <DialogTitle className="text-base font-bold text-foreground">Hapus Workspace Permanen?</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Tindakan ini tidak dapat dibatalkan. Seluruh konten, skema field, berkas media, dan pengaturan akan dihapus selamanya.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
                  Ketik <code className="font-mono font-bold bg-background/80 px-1.5 py-0.5 rounded text-foreground">{tenantSlug}</code> di bawah untuk konfirmasi:
                </div>
                <Input
                  placeholder={`Ketik ${tenantSlug} untuk konfirmasi`}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="rounded-xl h-9 text-xs font-mono"
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="rounded-xl text-xs font-bold h-9">
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteWorkspace}
                  disabled={deleteConfirm !== tenantSlug}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  Ya, Hapus Workspace
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </div>
  )
}
