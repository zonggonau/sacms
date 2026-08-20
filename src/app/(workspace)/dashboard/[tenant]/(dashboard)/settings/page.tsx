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
  Globe,
  Database,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Activity,
  Server,
  Mail,
  Copy,
  Key,
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

  // API & CORS settings
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
  }, [session?.user?.id])

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
        // Fetch content types
        const ctData = await getContentTypesAction(tenantSlug)
        if (ctData && !ctData.error) {
          setContentTypes(ctData.contentTypes || [])
        }

        // Fetch tenant settings
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
          setDaysRemaining(settings.daysRemaining !== undefined ? settings.daysRemaining : null)
          setApiVersion(settings.apiVersion || "v1")
          setRateLimiting(settings.rateLimiting ?? true)
          setRequestsPerMinute(String(settings.requestsPerMinute || 60))
          setBurstLimit(String(settings.burstLimit || 100))
          setCorsOrigins(settings.corsOrigins || "")
          setTwoFactorRequired(settings.twoFactorRequired ?? false)
          setIpWhitelist(settings.ipWhitelist ?? false)
          setAllowedIps(settings.allowedIps || "")
          setIsEnterprise(settings.isEnterprise ?? false)
          setDatabaseUrl(settings.databaseUrl || "")
          setSmtpHost(settings.smtpHost || "")
          setSmtpPort(settings.smtpPort || "")
          setSmtpUser(settings.smtpUser || "")
          setSmtpPassword(settings.smtpPassword || "")
          setFromEmail(settings.fromEmail || "")
          setFromName(settings.fromName || "")
          if (settings.storageConfig) {
            setStorageEndpoint(settings.storageConfig.endpoint || "")
            setStorageAccessKey(settings.storageConfig.accessKey || "")
            setStorageSecretKey(settings.storageConfig.secretKey || "")
            setStorageBucket(settings.storageConfig.bucket || "")
            setStoragePublicUrl(settings.storageConfig.publicUrl || "")
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.id) {
      fetchData()
    }
  }, [tenantSlug, session?.user?.id])

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
      toast.error("Gagal menyimpan pengaturan")
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
        toast.success("Data berhasil diekspor!")
      } else {
        toast.error("Gagal mengekspor data")
      }
    } catch (error) {
      console.error("Export failed:", error)
      toast.error("Gagal mengekspor data")
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!confirm("Apakah Anda yakin ingin mengimpor data ini? Ini dapat menimpa konfigurasi yang ada.")) return
    
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
        window.location.reload()
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal mengimpor data")
      }
    } catch (error) {
      console.error("Import failed:", error)
      toast.error("Gagal mengimpor data")
    } finally {
      setSaving(false)
      e.target.value = ""
    }
  }

  const handleDeleteContent = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus semua entri konten? Tindakan ini tidak dapat dibatalkan.")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast.success("Semua entri konten berhasil dikosongkan")
      } else {
        toast.error("Gagal menghapus konten")
      }
    } catch (error) {
      console.error("Delete failed:", error)
      toast.error("Gagal menghapus konten")
    }
  }

  const handleDeleteWorkspace = async () => {
    if (deleteConfirm !== tenantSlug) {
      toast.error("Ketik URL slug workspace untuk konfirmasi penghapusan")
      return
    }

    if (!currentTenant?.id) {
      toast.error("ID Workspace tidak ditemukan. Silakan muat ulang halaman.")
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
      toast.error("Gagal menghapus workspace")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center flex-1 flex-col w-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <Building2 className="h-6 w-6 text-primary" />
                Pengaturan Workspace
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Kelola identitas workspace, pembatasan CORS & rate limit, SMTP email, dan konfigurasi keamanan.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="rounded-xl text-xs font-bold h-9 px-4 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Simpan Perubahan
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
            <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/80 flex flex-wrap h-auto gap-1">
              <TabsTrigger value="general" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                Umum
              </TabsTrigger>
              <TabsTrigger value="api" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                CORS & Rate Limit
              </TabsTrigger>
              <TabsTrigger value="email" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                Email SMTP
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                Keamanan
              </TabsTrigger>
              <TabsTrigger value="usage" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <Activity className="h-3.5 w-3.5 mr-1.5" />
                Penggunaan
              </TabsTrigger>
              {isEnterprise && (
                <TabsTrigger value="infrastructure" className="rounded-lg text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-xs">
                  <Server className="h-3.5 w-3.5 mr-1.5" />
                  Infrastruktur
                </TabsTrigger>
              )}
              <TabsTrigger value="danger" className="rounded-lg text-xs font-semibold text-destructive data-[state=active]:bg-card data-[state=active]:shadow-xs">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Danger Zone
              </TabsTrigger>
            </TabsList>

            <TabsContent value="usage">
              <UsageTab tenantSlug={tenantSlug} />
            </TabsContent>

            <TabsContent value="general">
              <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">Identitas & Informasi Workspace</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Konfigurasikan nama dan deskripsi workspace Anda.
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
                      <Label htmlFor="workspace-slug" className="text-xs font-semibold text-foreground">URL Slug Workspace</Label>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground bg-muted/60 px-3 py-2 rounded-l-xl border border-r-0 border-border/80 h-9 flex items-center font-mono">
                          sacms.io/
                        </span>
                        <Input
                          id="workspace-slug"
                          value={tenantSlug}
                          disabled
                          className="rounded-l-none rounded-r-xl bg-muted/30 border-border/80 h-9 text-xs font-mono"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        URL slug bersifat permanen dan tidak dapat diubah setelah dibuat.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="workspace-description" className="text-xs font-semibold text-foreground">Deskripsi</Label>
                    <Textarea
                      id="workspace-description"
                      placeholder="Jelaskan tujuan atau proyek workspace ini..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="rounded-xl text-xs bg-background border-border/80"
                    />
                  </div>
                  <Separator className="bg-border/60" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Paket Aktif</Label>
                      <Select value={plan} onValueChange={setPlan} disabled>
                        <SelectTrigger className="rounded-xl h-9 text-xs bg-muted/30 border-border/80 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="free" className="text-xs rounded-lg">Free</SelectItem>
                          <SelectItem value="starter" className="text-xs rounded-lg">Starter</SelectItem>
                          <SelectItem value="pro" className="text-xs rounded-lg">Pro</SelectItem>
                          <SelectItem value="enterprise" className="text-xs rounded-lg">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-muted-foreground">
                        Upgrade paket Anda melalui menu Langganan & Tagihan.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Status Operasional</Label>
                      <div className="flex items-center gap-2 pt-1">
                        {subscriptionStatus === 'trialing' ? (
                          <Badge 
                            className="capitalize text-[10px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20 rounded-full"
                          >
                            Trial {daysRemaining !== null ? `(${daysRemaining} Hari)` : ''}
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline"
                            className={cn(
                              "capitalize text-[10px] font-bold rounded-full",
                              tenantStatus === 'active' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {tenantStatus === 'active' ? 'Aktif' : tenantStatus} {tenantStatus === 'active' && daysRemaining !== null ? `(${daysRemaining} Hari)` : ''}
                          </Badge>
                        )}
                        {tenantStatus === "active" && subscriptionStatus !== 'trialing' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="space-y-6">
              <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    CORS, Rate Limiting & Parameter API
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Pengaturan proteksi beban request, batas rate limit, dan izin domain CORS publik.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Workspace ID / Tenant ID</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type="text"
                          value={tenantId || ""}
                          readOnly
                          className="pr-10 font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                          onClick={() => {
                            if (tenantId) {
                              navigator.clipboard.writeText(tenantId)
                              toast.success("Workspace ID disalin")
                            }
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Gunakan ID ini untuk rute publik: <code>/api/public/{tenantId || '[tenant-id]'}/content</code>
                    </p>
                  </div>

                  {/* Centralized API Token Banner */}
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Key className="h-3.5 w-3.5 text-primary" />
                        Manajemen API Token & Hak Akses Terpusat
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Pembuatan multi-token terenkripsi SHA-256, hak akses granular (Read-Only/Full-Access), dan integrasi v0/MCP dikelola di Developer Portal.
                      </p>
                    </div>
                    <Button size="sm" asChild className="rounded-xl text-xs font-bold h-8 bg-primary text-primary-foreground shrink-0 shadow-xs">
                      <a href={`/dashboard/${tenantSlug}/developer/api-keys`}>
                        Buka API Keys &rarr;
                      </a>
                    </Button>
                  </div>

                  <Separator className="bg-border/60" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Versi API Publik</Label>
                    <Select value={apiVersion} onValueChange={setApiVersion}>
                      <SelectTrigger className="w-48 h-9 rounded-xl text-xs bg-background border-border/80 font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="v1" className="text-xs rounded-lg">v1 (Stabil)</SelectItem>
                        <SelectItem value="v2" className="text-xs rounded-lg">v2 (Beta)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator className="bg-border/60" />
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Rate Limiting (Proteksi Beban)</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Batasi frekuensi request API per menit untuk mencegah penyalahgunaan.
                      </p>
                    </div>
                    <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
                  </div>
                  {rateLimiting && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">Request per Menit</Label>
                        <Input
                          type="number"
                          value={requestsPerMinute}
                          onChange={(e) => setRequestsPerMinute(e.target.value)}
                          className="rounded-xl h-9 text-xs bg-background border-border/80"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-foreground">Batas Burst (Lonjakan)</Label>
                        <Input
                          type="number"
                          value={burstLimit}
                          onChange={(e) => setBurstLimit(e.target.value)}
                          className="rounded-xl h-9 text-xs bg-background border-border/80"
                        />
                      </div>
                    </div>
                  )}
                  <Separator className="bg-border/60" />
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Domain Diizinkan (CORS)</Label>
                    <Textarea
                      placeholder="Masukkan domain asal, satu per baris&#10;https://domainanda.com&#10;https://app.domainanda.com"
                      rows={3}
                      value={corsOrigins}
                      onChange={(e) => setCorsOrigins(e.target.value)}
                      className="rounded-xl text-xs font-mono bg-background border-border/80"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Tuliskan nama domain satu per baris. Gunakan * untuk mengizinkan semua domain (hanya development).
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email">
              <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">Konfigurasi Email SMTP</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Pengaturan server SMTP khusus untuk pengiriman notifikasi email keluar dari workspace ini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpHost" className="text-xs font-semibold text-foreground">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.mailgun.org"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPort" className="text-xs font-semibold text-foreground">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpUser" className="text-xs font-semibold text-foreground">SMTP User / Akun</Label>
                      <Input
                        id="smtpUser"
                        placeholder="user@domain.com"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="smtpPassword" className="text-xs font-semibold text-foreground">SMTP Password</Label>
                      <Input
                        id="smtpPassword"
                        type="password"
                        placeholder="••••••••"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                  </div>
                  <Separator className="bg-border/60" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fromEmail" className="text-xs font-semibold text-foreground">Email Pengirim Default</Label>
                      <Input
                        id="fromEmail"
                        placeholder="noreply@domainanda.com"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fromName" className="text-xs font-semibold text-foreground">Nama Pengirim Default</Label>
                      <Input
                        id="fromName"
                        placeholder="Tim ContentFlow"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">Keamanan & Kontrol Akses</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Tingkatkan proteksi autentikasi dan restriksi alamat IP workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Autentikasi Dua Faktor (2FA)</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Wajibkan 2FA bagi seluruh anggota tim saat masuk ke workspace ini.
                      </p>
                    </div>
                    <Switch checked={twoFactorRequired} onCheckedChange={setTwoFactorRequired} />
                  </div>
                  <Separator className="bg-border/60" />
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">IP Whitelist (Restriksi Alamat IP)</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Batasi akses hanya dari alamat IP kantor atau VPN yang diizinkan.
                      </p>
                    </div>
                    <Switch checked={ipWhitelist} onCheckedChange={setIpWhitelist} />
                  </div>
                  {ipWhitelist && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">Daftar IP yang Diizinkan</Label>
                      <Textarea
                        placeholder="Masukkan IP address, satu per baris&#10;192.168.1.1&#10;10.0.0.0/24"
                        rows={3}
                        value={allowedIps}
                        onChange={(e) => setAllowedIps(e.target.value)}
                        className="rounded-xl text-xs font-mono bg-background border-border/80"
                      />
                    </div>
                  )}
                  <Separator className="bg-border/60" />
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Audit Trail & Logging</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Catat seluruh mutasi konten, perubahan skema, dan akses API secara permanen.
                      </p>
                    </div>
                    <Switch checked={auditLogging} onCheckedChange={setAuditLogging} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {isEnterprise && (
              <TabsContent value="infrastructure">
                <Card className="border border-border/80 rounded-2xl shadow-xs bg-card overflow-hidden">
                  <CardHeader className="p-5 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">Infrastruktur Dedicated (BYO)</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Koneksikan database PostgreSQL dan bucket S3 khusus milik perusahaan Anda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" /> Database PostgreSQL Dedicated
                      </h3>
                      <div className="space-y-1.5">
                        <Label htmlFor="dbUrl" className="text-xs font-semibold text-muted-foreground">Connection String</Label>
                        <Input
                          id="dbUrl"
                          type="password"
                          placeholder="postgresql://user:pass@host:5432/dbname"
                          value={databaseUrl}
                          onChange={(e) => setDatabaseUrl(e.target.value)}
                          className="rounded-xl h-9 text-xs bg-background border-border/80"
                        />
                      </div>
                    </div>

                    <Separator className="bg-border/60" />

                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Server className="h-4 w-4 text-primary" /> Storage Cloudflare R2 / AWS S3
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="s3Endpoint" className="text-xs font-semibold text-muted-foreground">Endpoint URL</Label>
                          <Input
                            id="s3Endpoint"
                            placeholder="https://<account-id>.r2.cloudflarestorage.com"
                            value={storageEndpoint}
                            onChange={(e) => setStorageEndpoint(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="s3Bucket" className="text-xs font-semibold text-muted-foreground">Bucket Name</Label>
                          <Input
                            id="s3Bucket"
                            placeholder="workspace-bucket"
                            value={storageBucket}
                            onChange={(e) => setStorageBucket(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="s3Access" className="text-xs font-semibold text-muted-foreground">Access Key ID</Label>
                          <Input
                            id="s3Access"
                            type="password"
                            value={storageAccessKey}
                            onChange={(e) => setStorageAccessKey(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="s3Secret" className="text-xs font-semibold text-muted-foreground">Secret Access Key</Label>
                          <Input
                            id="s3Secret"
                            type="password"
                            value={storageSecretKey}
                            onChange={(e) => setStorageSecretKey(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            <TabsContent value="danger">
              <Card className="border border-rose-500/30 rounded-2xl shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 border-b border-rose-500/20 bg-rose-500/5">
                  <CardTitle className="text-sm font-bold text-rose-600 dark:text-rose-400">Danger Zone (Aksi Kritis)</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Tindakan permanen yang berpengaruh langsung terhadap seluruh data dan aset workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/80 rounded-xl gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Ekspor & Impor Data Workspace</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Cadangkan atau pulihkan seluruh struktur skema dan entri konten dalam format JSON.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleExport} className="rounded-xl text-xs font-bold h-9">
                        <Download className="mr-1.5 h-3.5 w-3.5" /> Ekspor JSON
                      </Button>
                      <div className="relative">
                        <Input 
                          type="file" 
                          accept=".json"
                          onChange={handleImport}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          disabled={saving}
                        />
                        <Button variant="outline" disabled={saving} className="rounded-xl text-xs font-bold h-9">
                          <Download className="mr-1.5 h-3.5 w-3.5 rotate-180" /> Impor
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-border/80 rounded-xl gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Kosongkan Seluruh Entri Konten</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Hapus semua entri konten yang tersimpan namun tetap mempertahankan struktur skema.
                      </p>
                    </div>
                    <Button variant="destructive" onClick={handleDeleteContent} className="rounded-xl text-xs font-bold h-9">
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Konten
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-rose-500/30 rounded-xl bg-rose-500/5 gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400">Hapus Workspace Permanen</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Menghapus permanen seluruh workspace, skema, entri, media, dan API keys.
                      </p>
                    </div>
                    <Button 
                      variant="destructive" 
                      disabled={plan !== 'free' && plan !== 'trial' && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')}
                      onClick={() => {
                        if (plan !== 'free' && plan !== 'trial' && (subscriptionStatus === 'active' || subscriptionStatus === 'trialing')) {
                          toast.error("Tidak dapat menghapus workspace berbayar yang masih aktif.");
                          return;
                        }
                        setShowDeleteDialog(true)
                      }}
                      className="rounded-xl text-xs font-bold h-9"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Hapus Workspace
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Delete Workspace Dialog */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="rounded-2xl border-border/80 bg-card sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-rose-600 dark:text-rose-400">Hapus Workspace Permanen</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Aksi ini tidak dapat dibatalkan. Seluruh data konten, media, dan konfigurasi akan dihapus secara permanen.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs text-destructive font-medium">
                  Ketik <code className="bg-background px-1.5 py-0.5 rounded font-mono font-bold">{tenantSlug}</code> untuk konfirmasi:
                </div>
                <Input
                  placeholder={`Ketik ${tenantSlug}`}
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="rounded-xl h-9 text-xs bg-background border-border/80"
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
                  Hapus Permanen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}
