"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Loader2, Save, Server, Info, RefreshCw, Copy, Database, Check,
  Shield, Key, Sparkles, Image as ImageIcon, HardDrive,
  Globe, AlertTriangle, Trash2, Cpu, Sliders, Lock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"
import { v4 as uuidv4 } from "uuid"
import { cn } from "@/lib/utils"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [purgingCache, setPurgingCache] = useState(false)
  const [testAiLoading, setTestAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // Comprehensive Settings State with robust defaults
  const [settings, setSettings] = useState({
    // Tab 1: Workspace & Registration
    globalTenantId: "sacms-global",
    registrationMode: "open", // open | invite_only | closed
    defaultUserPlan: "free", // free | starter | pro_trial
    maxWorkspacesPerUser: "1",
    autoProvisionSeedData: "true",
    customDomainPolicy: "paid_only", // all_plans | paid_only | disabled
    defaultStorageLimitMb: "500",

    // Tab 2: Security & API Gateway
    maintenanceMode: "false",
    maintenanceMessage: "Platform SaCMS sedang dalam pemeliharaan terjadwal. Silakan coba kembali beberapa saat lagi.",
    maintenanceIpWhitelist: "127.0.0.1",
    apiRateLimitPerMinute: "120",
    globalCorsPolicy: "wildcard", // wildcard | strict_tenant
    ipBlacklist: "",
    webhookMaxRetries: "3",

    // Tab 3: Media & AI Engine
    maxUploadFileSizeMb: "25",
    allowedFileExtensions: ".jpg, .jpeg, .png, .webp, .svg, .pdf, .mp4",
    autoWebpConvert: "true",
    autoGenerateThumbnails: "true",
    platformAiProvider: "openai", // openai | gemini | anthropic
    platformAiApiKey: "",
    defaultAiModel: "gpt-4o-mini",
    freePlanAiMonthlyWords: "10000",

    // Tab 4: Runtime & Retention
    auditLogRetentionDays: "90",
    apiLogRetentionDays: "14",
  })

  const generateTenantId = () => {
    const newId = "wks_" + uuidv4().replace(/-/g, '').substring(0, 24)
    setSettings((prev) => ({ ...prev, globalTenantId: newId }))
    toast({ title: "ID Workspace Baru Dibuat", description: "Klik 'Simpan Perubahan' untuk menerapkan pengaturan." })
  }

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings")
      if (res.ok) {
        const data = await res.json()
        if (data.settings && Object.keys(data.settings).length > 0) {
          setSettings((prev) => ({ ...prev, ...data.settings }))
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchSettings()
    }
  }, [session?.user?.id, session?.user?.role])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (res.ok) {
        toast({ title: "Pengaturan Berhasil Disimpan", description: "Seluruh parameter konfigurasi platform berhasil diperbarui." })
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Menyimpan", description: "Terjadi kesalahan saat menyimpan pengaturan platform." })
    } finally {
      setSaving(false)
    }
  }

  const handlePurgeCache = async () => {
    if (!confirm("Apakah Anda yakin ingin membersihkan seluruh cache Edge/Redis platform?")) return
    setPurgingCache(true)
    try {
      const res = await fetch("/api/admin/settings/purge-cache", { method: "POST" })
      if (res.ok) {
        toast({ title: "Cache Dibersihkan", description: "Cache Edge/Redis platform berhasil di-flush." })
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal membersihkan cache." })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan saat membersihkan cache." })
    } finally {
      setPurgingCache(false)
    }
  }

  const handleTestAi = async () => {
    if (!settings.platformAiApiKey) {
      toast({ variant: "destructive", title: "API Key Kosong", description: "Masukkan API Key terlebih dahulu." })
      return
    }
    setTestAiLoading(true)
    try {
      const res = await fetch("/api/admin/settings/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: settings.platformAiProvider,
          apiKey: settings.platformAiApiKey,
          model: settings.defaultAiModel
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Koneksi Berhasil", description: data.message })
      } else {
        toast({ variant: "destructive", title: "Koneksi Gagal", description: data.message || "Gagal menghubungi server AI" })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: e.message || "Kesalahan jaringan" })
    } finally {
      setTestAiLoading(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <AdminPageSkeleton layout="form" cardsCount={0} />
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Pengaturan Platform</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  Master Controls
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pusat kendali operasional, perizinan workspace, batasan kuota, dan keamanan sistem SaCMS.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </div>

          {/* Maintenance Mode Warning if Active */}
          {settings.maintenanceMode === "true" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-700 dark:text-amber-300 shadow-xs">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-xs">
                <strong className="font-bold">Mode Pemeliharaan Sedang Aktif:</strong> Dashboard workspace tenant saat ini dikunci untuk pengguna biasa.
              </div>
            </div>
          )}

          {/* Navigation Tabs */}
          <Tabs defaultValue="workspaces" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-2 md:grid-cols-4 h-auto gap-1">
              <TabsTrigger 
                value="workspaces" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Database className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Workspace & Registrasi
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Keamanan & Gateway
              </TabsTrigger>
              <TabsTrigger 
                value="media_ai" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Media & Mesin AI
              </TabsTrigger>
              <TabsTrigger 
                value="runtime" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Server className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Runtime & Operasi
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: WORKSPACE & REGISTRATION */}
            <TabsContent value="workspaces" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Global Master Tenant */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Database className="h-4 w-4 text-primary" />
                      ID Workspace Induk (System Master)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Tenant global yang menyajikan data publik seperti Landing Page, Paket Langganan, dan Addon.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="global-tenant-id" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID Tenant Aktif</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input 
                            id="global-tenant-id" 
                            value={settings.globalTenantId} 
                            readOnly 
                            className="pr-9 font-mono text-xs bg-muted/20 border-border/80 rounded-xl h-9 text-foreground" 
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground rounded-xl"
                            onClick={() => {
                              navigator.clipboard.writeText(settings.globalTenantId)
                              setCopied(true)
                              setTimeout(() => setCopied(false), 1500)
                              toast({ title: "Tersalin", description: "ID Workspace berhasil disalin" })
                            }}
                          >
                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          title="Generate ID Baru"
                          className="h-9 w-9 shrink-0 rounded-xl border-border/80 hover:bg-muted"
                          onClick={generateTenantId}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Membuat ID baru akan memetakan API global ke instance tenant baru. Konten dari tenant sebelumnya tetap aman di basis data PostgreSQL.
                    </p>
                  </CardContent>
                </Card>

                {/* Registration & New Account Defaults */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Sliders className="h-4 w-4 text-primary" />
                      Kebijakan Registrasi Akun Baru
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Pengaturan pembuatan akun dan inisialisasi default tenant baru.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mode Pendaftaran Pengguna</Label>
                      <Select 
                        value={settings.registrationMode} 
                        onValueChange={v => setSettings(prev => ({ ...prev, registrationMode: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="open" className="text-xs rounded-lg">Terbuka untuk Umum (Public Registration)</SelectItem>
                          <SelectItem value="invite_only" className="text-xs rounded-lg">Hanya Melalui Undangan (Invite Only)</SelectItem>
                          <SelectItem value="closed" className="text-xs rounded-lg">Pendaftaran Ditutup Sementara</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Paket Default</Label>
                        <Select 
                          value={settings.defaultUserPlan} 
                          onValueChange={v => setSettings(prev => ({ ...prev, defaultUserPlan: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="free" className="text-xs rounded-lg">Paket Gratis (Free)</SelectItem>
                            <SelectItem value="starter" className="text-xs rounded-lg">Starter</SelectItem>
                            <SelectItem value="pro_trial" className="text-xs rounded-lg">Pro (Trial 14 Hari)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Max Workspace / User</Label>
                        <Input 
                          type="number"
                          value={settings.maxWorkspacesPerUser}
                          onChange={e => setSettings(prev => ({ ...prev, maxWorkspacesPerUser: e.target.value }))}
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold text-foreground">Starter Template Seed Data</Label>
                        <p className="text-[11px] text-muted-foreground">Otomatis buat contoh tipe konten saat workspace baru dibuat</p>
                      </div>
                      <Switch 
                        checked={settings.autoProvisionSeedData === "true"}
                        onCheckedChange={c => setSettings(prev => ({ ...prev, autoProvisionSeedData: c ? "true" : "false" }))}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Domain & Storage Defaults */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card md:col-span-2">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Globe className="h-4 w-4 text-primary" />
                      Domain Kustom & Kuota Penyimpanan Standar
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Batas alokasi fitur dan resource untuk seluruh workspace baru.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kebijakan Custom Domain</Label>
                      <Select 
                        value={settings.customDomainPolicy} 
                        onValueChange={v => setSettings(prev => ({ ...prev, customDomainPolicy: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="paid_only" className="text-xs rounded-lg">Khusus Paket Berbayar (Starter, Pro, Enterprise)</SelectItem>
                          <SelectItem value="all_plans" className="text-xs rounded-lg">Semua Paket (Termasuk Free Tier)</SelectItem>
                          <SelectItem value="disabled" className="text-xs rounded-lg">Nonaktifkan Fitur Domain Kustom</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">Mengatur apakah tenant diizinkan menambahkan domain sendiri (e.g. news.domain.com).</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batas Storage Default Paket Free (MB)</Label>
                      <Input 
                        type="number"
                        value={settings.defaultStorageLimitMb}
                        onChange={e => setSettings(prev => ({ ...prev, defaultStorageLimitMb: e.target.value }))}
                        placeholder="500"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                      <p className="text-[11px] text-muted-foreground">Kapasitas penyimpanan media awal yang diberikan kepada workspace Free.</p>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 2: SECURITY & GATEWAY */}
            <TabsContent value="security" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Maintenance Mode */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Lock className="h-4 w-4 text-primary" />
                      Mode Pemeliharaan (Maintenance Mode)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kunci dashboard platform untuk pembaruan atau migrasi database darurat.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/60">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold text-foreground">Aktifkan Mode Pemeliharaan</Label>
                        <p className="text-[11px] text-muted-foreground">Hanya Super Admin yang dapat mengakses dashboard</p>
                      </div>
                      <Switch 
                        checked={settings.maintenanceMode === "true"}
                        onCheckedChange={c => setSettings(prev => ({ ...prev, maintenanceMode: c ? "true" : "false" }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pesan Pemeliharaan untuk Pengguna</Label>
                      <Textarea 
                        value={settings.maintenanceMessage}
                        onChange={e => setSettings(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                        rows={2}
                        className="rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">IP Whitelist Pemeliharaan</Label>
                      <Input 
                        value={settings.maintenanceIpWhitelist}
                        onChange={e => setSettings(prev => ({ ...prev, maintenanceIpWhitelist: e.target.value }))}
                        placeholder="127.0.0.1, 103.21.x.x"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">Daftar IP yang tetap diizinkan mengakses saat maintenance aktif (pisahkan koma).</p>
                    </div>
                  </CardContent>
                </Card>

                {/* API Gateway & Rate Limit */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      Gerbang API & Rate Limiting
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Proteksi terhadap traffic burst, scraping liar, dan penyalahgunaan webhook.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate Limit (Req/Menit)</Label>
                        <Input 
                          type="number"
                          value={settings.apiRateLimitPerMinute}
                          onChange={e => setSettings(prev => ({ ...prev, apiRateLimitPerMinute: e.target.value }))}
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Webhook Retry DLQ</Label>
                        <Select 
                          value={settings.webhookMaxRetries}
                          onValueChange={v => setSettings(prev => ({ ...prev, webhookMaxRetries: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="3" className="text-xs rounded-lg">3 Kali Percobaan</SelectItem>
                            <SelectItem value="5" className="text-xs rounded-lg">5 Kali Percobaan</SelectItem>
                            <SelectItem value="10" className="text-xs rounded-lg">10 Kali Percobaan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kebijakan CORS Global</Label>
                      <Select 
                        value={settings.globalCorsPolicy}
                        onValueChange={v => setSettings(prev => ({ ...prev, globalCorsPolicy: v }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="wildcard" className="text-xs rounded-lg">Izinkan Semua Domain (* Wildcard CORS)</SelectItem>
                          <SelectItem value="strict_tenant" className="text-xs rounded-lg">Ketat per Domain Terdaftar Tenant</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Global IP Blacklist</Label>
                      <Textarea 
                        value={settings.ipBlacklist}
                        onChange={e => setSettings(prev => ({ ...prev, ipBlacklist: e.target.value }))}
                        placeholder="192.168.1.100, 10.0.0.5"
                        rows={2}
                        className="rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">Blokir IP mencurigakan secara instan di Edge Middleware.</p>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 3: MEDIA & AI ENGINE */}
            <TabsContent value="media_ai" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Media Upload Engine */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Penyimpanan Media & Cloudflare R2
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kontrol ukuran berkas, kompresi gambar, dan format upload yang diizinkan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batas Ukuran Upload File (MB)</Label>
                      <Input 
                        type="number"
                        value={settings.maxUploadFileSizeMb}
                        onChange={e => setSettings(prev => ({ ...prev, maxUploadFileSizeMb: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Whitelist Format File</Label>
                      <Input 
                        value={settings.allowedFileExtensions}
                        onChange={e => setSettings(prev => ({ ...prev, allowedFileExtensions: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">Format ekstensi yang boleh diupload ke pustaka media.</p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border/60">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-bold text-foreground">Otomatis Optimasi WebP</Label>
                          <p className="text-[11px] text-muted-foreground">Kompresi gambar saat diunggah untuk hemat bandwidth</p>
                        </div>
                        <Switch 
                          checked={settings.autoWebpConvert === "true"}
                          onCheckedChange={c => setSettings(prev => ({ ...prev, autoWebpConvert: c ? "true" : "false" }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-xs font-bold text-foreground">Generate Thumbnail Cepat</Label>
                          <p className="text-[11px] text-muted-foreground">Buat thumbnail 200x200 untuk grid media library</p>
                        </div>
                        <Switch 
                          checked={settings.autoGenerateThumbnails === "true"}
                          onCheckedChange={c => setSettings(prev => ({ ...prev, autoGenerateThumbnails: c ? "true" : "false" }))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Content Engine */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Mesin AI Terpusat (Platform AI Engine)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Penyedia AI global untuk fitur auto-generate artikel, SEO meta, dan auto-translate.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider AI Utama</Label>
                        <Select 
                          value={settings.platformAiProvider}
                          onValueChange={v => setSettings(prev => ({ ...prev, platformAiProvider: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="openai" className="text-xs rounded-lg">OpenAI (ChatGPT)</SelectItem>
                            <SelectItem value="gemini" className="text-xs rounded-lg">Google Gemini</SelectItem>
                            <SelectItem value="anthropic" className="text-xs rounded-lg">Anthropic Claude</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model AI Standar</Label>
                        <Select 
                          value={settings.defaultAiModel}
                          onValueChange={v => setSettings(prev => ({ ...prev, defaultAiModel: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="gpt-4o-mini" className="text-xs rounded-lg">GPT-4o Mini (Cepat & Hemat)</SelectItem>
                            <SelectItem value="gpt-4o" className="text-xs rounded-lg">GPT-4o (Akurasi Tinggi)</SelectItem>
                            <SelectItem value="gemini-1.5-flash" className="text-xs rounded-lg">Gemini 1.5 Flash</SelectItem>
                            <SelectItem value="claude-3-5-haiku" className="text-xs rounded-lg">Claude 3.5 Haiku</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Platform API Key (Fallback)</Label>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          disabled={testAiLoading || !settings.platformAiApiKey}
                          onClick={handleTestAi}
                          className="h-6 text-[10px] font-bold text-primary hover:text-primary/80 px-2 rounded-md"
                        >
                          {testAiLoading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          {testAiLoading ? "Menguji..." : "Uji Koneksi AI"}
                        </Button>
                      </div>
                      <Input 
                        type="password"
                        value={settings.platformAiApiKey}
                        onChange={e => setSettings(prev => ({ ...prev, platformAiApiKey: e.target.value }))}
                        placeholder="sk-..."
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">Digunakan oleh seluruh tenant yang tidak mengonfigurasi API key mandiri.</p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batas Kata AI Bulanan (Free Plan)</Label>
                      <Input 
                        type="number"
                        value={settings.freePlanAiMonthlyWords}
                        onChange={e => setSettings(prev => ({ ...prev, freePlanAiMonthlyWords: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                      <p className="text-[11px] text-muted-foreground">Maksimal kata yang dapat di-generate oleh akun gratis per bulan.</p>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 4: RUNTIME & SYSTEM OPERATIONS */}
            <TabsContent value="runtime" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Runtime Specifications */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Server className="h-4 w-4 text-primary" /> Informasi Runtime & Ekosistem
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">Spesifikasi lingkungan server SaCMS</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/60 text-xs">
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Framework & Engine</span>
                        <span className="font-mono font-bold text-foreground">Next.js 16 (App Router)</span>
                      </div>
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Environment Mode</span>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-full border-border/60">{process.env.NODE_ENV}</Badge>
                      </div>
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Basis Data Utama</span>
                        <span className="font-bold text-foreground">PostgreSQL (Prisma ORM)</span>
                      </div>
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Penyimpanan Objek Cloud</span>
                        <span className="font-bold text-primary">Cloudflare R2 (S3 Protocol)</span>
                      </div>
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Edge Cache & Rate Limiting</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">Upstash Redis</span>
                      </div>
                      <div className="p-3.5 px-5 flex justify-between items-center">
                        <span className="text-muted-foreground font-medium">Gateway Pembayaran</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">Midtrans Snap API</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Operations & Log Retention */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Cpu className="h-4 w-4 text-primary" />
                      Operasi Platform & Retensi Log
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Pembersihan cache dan kebijakan penyimpanan riwayat aktivitas.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retensi Audit Log</Label>
                        <Select 
                          value={settings.auditLogRetentionDays}
                          onValueChange={v => setSettings(prev => ({ ...prev, auditLogRetentionDays: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="30" className="text-xs rounded-lg">30 Hari</SelectItem>
                            <SelectItem value="90" className="text-xs rounded-lg">90 Hari (Standar)</SelectItem>
                            <SelectItem value="180" className="text-xs rounded-lg">180 Hari (6 Bulan)</SelectItem>
                            <SelectItem value="365" className="text-xs rounded-lg">1 Tahun</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retensi Log API</Label>
                        <Select 
                          value={settings.apiLogRetentionDays}
                          onValueChange={v => setSettings(prev => ({ ...prev, apiLogRetentionDays: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="7" className="text-xs rounded-lg">7 Hari</SelectItem>
                            <SelectItem value="14" className="text-xs rounded-lg">14 Hari (Standar)</SelectItem>
                            <SelectItem value="30" className="text-xs rounded-lg">30 Hari</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2.5">
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-destructive">Pembersihan Cache Edge Redis</h4>
                        <p className="text-[11px] text-muted-foreground">
                          Membersihkan seluruh cache routing domain kustom, token blacklist, dan schema cache platform.
                        </p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handlePurgeCache} 
                        disabled={purgingCache}
                        className="rounded-xl text-xs font-bold h-8 shadow-xs"
                      >
                        {purgingCache ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                        {purgingCache ? "Membersihkan..." : "Flush Cache Platform"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

          </Tabs>

        </div>
      </div>
    </div>
  )
}
