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
  Loader2, Save, Server, RefreshCw, Copy, Database, Check,
  Shield, Sparkles, Image as ImageIcon,
  AlertTriangle, CreditCard, Mail, Send, Eye, EyeOff, Bot, HardDrive,
  Cpu, Zap, Globe, Layers, Key, CheckCircle2
} from "lucide-react"
import { AI_MODEL_REGISTRY } from "@/lib/ai/model-registry"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"
import { v4 as uuidv4 } from "uuid"

export default function AdminSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [purgingCache, setPurgingCache] = useState(false)
  const [testAiLoading, setTestAiLoading] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailRecipient, setTestEmailRecipient] = useState("")
  const [copied, setCopied] = useState(false)
  const [showMasks, setShowMasks] = useState<Record<string, boolean>>({})
  const [showDirectKeys, setShowDirectKeys] = useState(false)

  const toggleMask = (field: string) => {
    setShowMasks(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // Secret fields arrive from GET /api/admin/settings pre-masked ("••••••••").
  // Revealing one fetches the real value on demand (audited server-side) so
  // plaintext secrets never sit in the page's initial payload.
  const revealSecret = async (maskField: string, settingsKey: string) => {
    if (showMasks[maskField]) {
      setShowMasks(prev => ({ ...prev, [maskField]: false }))
      return
    }
    try {
      const res = await fetch(`/api/admin/settings/reveal?key=${encodeURIComponent(settingsKey)}`)
      if (!res.ok) throw new Error("reveal failed")
      const data = await res.json()
      setSettings(prev => ({ ...prev, [settingsKey]: data.value ?? "" }))
      setShowMasks(prev => ({ ...prev, [maskField]: true }))
    } catch {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal mengambil nilai rahasia." })
    }
  }

  // Comprehensive Settings State with robust defaults
  const [settings, setSettings] = useState({
    // Tab 1: Workspace & Registration
    globalTenantId: "sacms-global",
    registrationMode: "open",
    defaultUserPlan: "free",
    maxWorkspacesPerUser: "1",
    autoProvisionSeedData: "true",
    customDomainPolicy: "paid_only",
    defaultStorageLimitMb: "500",

    // Tab 2: Security & Gateway
    maintenanceMode: "false",
    maintenanceMessage: "Platform SaCMS sedang dalam pemeliharaan terjadwal. Silakan coba kembali beberapa saat lagi.",
    maintenanceIpWhitelist: "127.0.0.1",
    apiRateLimitPerMinute: "120",
    globalCorsPolicy: "wildcard",
    ipBlacklist: "",
    webhookMaxRetries: "3",

    // Tab 3: AI Engine & Providers (Vercel AI Gateway & SDK Core)
    aiGatewayApiKey: "",
    aiGatewayBaseUrl: "https://ai-gateway.vercel.sh/v1",
    platformAiProvider: "google",
    platformAiApiKey: "",
    deepseekApiKey: "",
    openaiApiKey: "",
    geminiApiKey: "",
    anthropicApiKey: "",
    groqApiKey: "",
    mistralApiKey: "",
    xaiApiKey: "",
    openrouterApiKey: "",
    v0ApiKey: "",
    vercelAccessToken: "",
    defaultAiModel: "gemini-2.5-flash",
    aiSdkDefaultModel: "gemini-2.5-flash",
    freePlanAiMonthlyWords: "10000",

    // Tab 4: Email & SMTP Delivery
    resendApiKey: "",
    resendFrom: "SaCMS <noreply@mail.sacms.cloud>",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: "false",
    smtpUser: "",
    smtpPass: "",
    smtpFrom: "SaCMS <noreply@mail.sacms.cloud>",

    // Tab 5: Billing & Midtrans
    midtransMode: "sandbox",
    midtransServerKey: "",
    midtransClientKey: "",

    // Tab 6: Storage & Dedicated Infrastructure
    maxUploadFileSizeMb: "25",
    allowedFileExtensions: ".jpg, .jpeg, .png, .webp, .svg, .pdf, .mp4",
    autoWebpConvert: "true",
    autoGenerateThumbnails: "true",
    r2AccountId: "",
    r2AccessKeyId: "",
    r2SecretAccessKey: "",
    r2BucketName: "",
    r2PublicUrl: "",

    // Retention
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
      if (session.user.email) {
        setTestEmailRecipient(session.user.email)
      }
    }
  }, [session?.user?.id, session?.user?.role, session?.user?.email])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
      if (res.ok) {
        toast({ title: "Pengaturan Berhasil Disimpan", description: "Seluruh parameter konfigurasi platform berhasil disinkronkan ke database & Redis cache." })
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
    if (
      !(await confirm({
        title: "Bersihkan seluruh cache Edge/Redis platform?",
        confirmLabel: "Bersihkan cache",
        variant: "destructive",
      }))
    )
      return
    setPurgingCache(true)
    try {
      const res = await fetch("/api/admin/settings/purge-cache", { method: "POST" })
      if (res.ok) {
        toast({ title: "Cache Dibersihkan", description: "Cache Edge/Redis platform berhasil di-flush." })
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal membersihkan cache." })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: e.message })
    } finally {
      setPurgingCache(false)
    }
  }

  const handleTestAi = async (targetProvider?: string, keyToTest?: string) => {
    const provider = targetProvider || (settings.aiGatewayApiKey ? "gateway" : settings.platformAiProvider) || "gateway"
    const apiKey = keyToTest || (
      provider === "gateway" || provider === "vercel_gateway" ? settings.aiGatewayApiKey :
      provider === "deepseek" ? (settings.deepseekApiKey || settings.platformAiApiKey) :
      provider === "openai" ? settings.openaiApiKey :
      provider === "gemini" ? settings.geminiApiKey :
      provider === "anthropic" ? settings.anthropicApiKey :
      provider === "groq" ? settings.groqApiKey :
      provider === "mistral" ? settings.mistralApiKey :
      provider === "xai" ? settings.xaiApiKey :
      provider === "openrouter" ? settings.openrouterApiKey : (settings.aiGatewayApiKey || settings.platformAiApiKey)
    )

    if (!apiKey) {
      toast({ variant: "destructive", title: "API Key Kosong", description: `Silakan masukkan API Key untuk ${provider === "gateway" ? "Vercel AI Gateway" : provider} sebelum melakukan tes koneksi.` })
      return
    }

    setTestAiLoading(true)
    setTestingProvider(provider)
    try {
      const res = await fetch("/api/admin/settings/test-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey,
          model: settings.defaultAiModel,
          baseUrl: settings.aiGatewayBaseUrl,
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: `Koneksi ${provider === "gateway" ? "Vercel AI Gateway" : provider.toUpperCase()} Berhasil!`, description: data.message })
      } else {
        toast({ variant: "destructive", title: `Uji Koneksi ${provider === "gateway" ? "Vercel AI Gateway" : provider.toUpperCase()} Gagal`, description: data.message || "Gagal menghubungi AI provider." })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: e.message || "Kesalahan jaringan" })
    } finally {
      setTestAiLoading(false)
      setTestingProvider(null)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmailRecipient) {
      toast({ variant: "destructive", title: "Email Tujuan Kosong", description: "Silakan masukkan alamat email penerima untuk pengujian." })
      return
    }

    setTestEmailLoading(true)
    try {
      const res = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEmail: testEmailRecipient,
          resendApiKey: settings.resendApiKey,
          resendFrom: settings.resendFrom,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser,
          smtpPass: settings.smtpPass,
          smtpFrom: settings.smtpFrom,
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast({ title: "Email Berhasil Dikirim!", description: data.message })
      } else {
        toast({ variant: "destructive", title: "Uji Email Gagal", description: data.message || "Gagal mengirim email tes." })
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: e.message || "Kesalahan jaringan" })
    } finally {
      setTestEmailLoading(false)
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
      {confirmDialog}
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
                Konfigurasi API keys, email, payment gateway, dan sistem.
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
          <Tabs defaultValue="ai_engine" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 h-auto gap-1">
              <TabsTrigger 
                value="ai_engine" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Bot className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Mesin AI
              </TabsTrigger>
              <TabsTrigger 
                value="email_smtp" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Mail className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Email & SMTP
              </TabsTrigger>
              <TabsTrigger 
                value="billing_payments" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Payment Midtrans
              </TabsTrigger>
              <TabsTrigger 
                value="storage_infra" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <HardDrive className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Storage & Infra
              </TabsTrigger>
              <TabsTrigger 
                value="workspaces" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Database className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Workspace
              </TabsTrigger>
              <TabsTrigger 
                value="security" 
                className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs transition-all"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5 hidden sm:inline" />
                Keamanan
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: MESIN AI & PROVIDERS (VERCEL AI SDK) */}
            <TabsContent value="ai_engine" className="space-y-6">
              {/* Vercel AI SDK Banner Header */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5 shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground font-extrabold text-[10px] px-2.5 py-0.5 shadow-xs">
                        Vercel AI SDK Core
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-bold">
                        Vercel AI Gateway (1 API Key)
                      </Badge>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 bg-emerald-500/10 font-bold">
                        26 Model • 8 Provider AI
                      </Badge>
                    </div>
                    <h3 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-primary" />
                      Mesin AI Builder & Vercel AI Gateway
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-3xl leading-relaxed">
                      Cukup gunakan <strong>1 API Key Vercel AI Gateway</strong> untuk mengaktifkan seluruh 26 model AI secara instan (Google Gemini, Anthropic Claude, OpenAI, DeepSeek, Groq, Mistral, xAI, dan OpenRouter).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={() => handleTestAi('gateway', settings.aiGatewayApiKey)}
                      disabled={testAiLoading}
                      className="rounded-xl text-xs font-bold shadow-xs h-9 px-4"
                    >
                      {testAiLoading && testingProvider === 'gateway' ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5 mr-1.5 text-amber-400 fill-amber-400" />
                      )}
                      Uji Koneksi Vercel AI Gateway
                    </Button>
                  </div>
                </div>
              </div>

              {/* 2 Main Cards: Gateway Setup + Default Model Preferences */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* CARD 1: VERCEL AI GATEWAY (7 cols) */}
                <div className="lg:col-span-7">
                  <Card className="rounded-2xl border-2 border-primary/30 shadow-md bg-card relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
                    <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Zap className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                              Vercel AI Gateway (Kunci Terpadu)
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground mt-0.5">
                              1 Kunci API untuk mengakses semua 26 model tanpa registrasi berulang.
                            </CardDescription>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-bold text-[10px]">
                          Rekomendasi Utama
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      {/* Gateway API Key */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                            <Key className="h-3.5 w-3.5 text-primary" />
                            Vercel AI Gateway API Key
                            <span className="text-[9px] text-muted-foreground font-mono font-normal">(AI_GATEWAY_API_KEY)</span>
                          </Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('gateway', 'aiGatewayApiKey')}>
                            {showMasks.gateway ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            {showMasks.gateway ? "Sembunyikan" : "Tampilkan"}
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Input 
                            type={showMasks.gateway ? "text" : "password"}
                            value={settings.aiGatewayApiKey}
                            onChange={e => setSettings(prev => ({ ...prev, aiGatewayApiKey: e.target.value }))}
                            placeholder="vck_•••••••••••••••• atau kunci AI Gateway Anda"
                            className="h-10 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                          />
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="h-10 text-xs rounded-xl px-4 font-semibold shrink-0"
                            onClick={() => handleTestAi('gateway', settings.aiGatewayApiKey)}
                            disabled={testAiLoading}
                          >
                            {testingProvider === 'gateway' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Tes Koneksi"}
                          </Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Otomatis merutekan permintaan ke Google Gemini, Claude, OpenAI, DeepSeek, Groq, Mistral, xAI, dan OpenRouter.
                        </p>
                      </div>

                      {/* Gateway Base URL */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Gateway Base URL (OpenAI-Compatible Endpoint)
                        </Label>
                        <Input 
                          type="text"
                          value={settings.aiGatewayBaseUrl}
                          onChange={e => setSettings(prev => ({ ...prev, aiGatewayBaseUrl: e.target.value }))}
                          placeholder="https://ai-gateway.vercel.sh/v1"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Default: <code>https://ai-gateway.vercel.sh/v1</code>. Anda juga bisa mengarahkan ke proxy gateway khusus atau Portkey/LiteLLM.
                        </p>
                      </div>

                      {/* Info highlight box */}
                      <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 text-xs text-foreground space-y-2">
                        <div className="font-semibold flex items-center gap-1.5 text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                          Keuntungan Menggunakan Vercel AI Gateway:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold">✓</span> 1 Tagihan & 1 Kunci API Terpusat
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold">✓</span> Otomatis Fallback & Retry
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold">✓</span> Monitoring Latensi Global
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-primary font-bold">✓</span> Zero Server Restart
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* CARD 2: MODEL DEFAULT & QUOTA (5 cols) */}
                <div className="lg:col-span-5 space-y-6">
                  <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                    <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                          <Bot className="h-4 w-4 text-primary" />
                          Preferensi Model & Kuota
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 font-bold">
                          Config AI Builder
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Konfigurasi default saat pengguna membuat website via AI Builder.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Provider AI Utama</Label>
                        <Select 
                          value={settings.platformAiProvider}
                          onValueChange={v => setSettings(prev => ({ ...prev, platformAiProvider: v as any }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card">
                            <SelectItem value="google" className="text-xs rounded-lg">🔵 Google Gemini (Gemini 2.5 Flash / Pro)</SelectItem>
                            <SelectItem value="anthropic" className="text-xs rounded-lg">🟤 Anthropic Claude (Claude 3.7 / 3.5 Sonnet)</SelectItem>
                            <SelectItem value="openai" className="text-xs rounded-lg">🟢 OpenAI (GPT-4o / o3-mini / o1)</SelectItem>
                            <SelectItem value="deepseek" className="text-xs rounded-lg">🟣 DeepSeek AI (DeepSeek V3 / R1 Reasoner)</SelectItem>
                            <SelectItem value="groq" className="text-xs rounded-lg">⚡ Groq LPU (Llama 3.3 70B • 300+ t/s)</SelectItem>
                            <SelectItem value="mistral" className="text-xs rounded-lg">🟠 Mistral AI (Codestral 2501 / Large 2)</SelectItem>
                            <SelectItem value="xai" className="text-xs rounded-lg">⬛ xAI Grok (Grok 2 / Vision)</SelectItem>
                            <SelectItem value="openrouter" className="text-xs rounded-lg">🌐 OpenRouter (Dynamic Auto Router)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Model Default AI Builder</Label>
                        <Select
                          value={settings.defaultAiModel}
                          onValueChange={v => setSettings(prev => ({ ...prev, defaultAiModel: v, aiSdkDefaultModel: v }))}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl border-border bg-card max-h-[300px]">
                            {AI_MODEL_REGISTRY.map((m) => (
                              <SelectItem key={m.id} value={m.id} className="text-xs rounded-lg">
                                <span className="mr-1.5">{m.providerIcon}</span>
                                <span className="font-semibold">{m.name}</span>
                                <span className="text-[10px] text-muted-foreground ml-1.5 font-mono">({m.id})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">
                          Model pilihan awal saat user membuka AI Studio. User tetap bebas memilih model lain di jendela modal picker.
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Batas Kata / Kredit Bulanan Plan Free</Label>
                        <Input 
                          type="number"
                          value={settings.freePlanAiMonthlyWords}
                          onChange={e => setSettings(prev => ({ ...prev, freePlanAiMonthlyWords: e.target.value }))}
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                        />
                      </div>

                      <div className="pt-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleTestAi(settings.platformAiProvider)}
                          disabled={testAiLoading}
                          className="w-full text-xs font-bold rounded-xl border-border/80 h-9"
                        >
                          {testAiLoading && !testingProvider ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                          )}
                          Uji Koneksi Provider AI Default ({settings.platformAiProvider})
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

              </div>

              {/* COLLAPSIBLE ACCORDION: Direct Provider Keys (Optional Fallback) */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                <CardHeader className="p-5 pb-4 border-b border-border/60 bg-muted/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        Kunci API Provider Langsung (Opsional / Fallback)
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Gunakan kunci API per-provider jika Anda tidak menggunakan Vercel AI Gateway atau ingin fallback server lokal.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDirectKeys(!showDirectKeys)}
                      className="rounded-xl text-xs font-semibold h-8 border-border/80"
                    >
                      {showDirectKeys ? "Sembunyikan Kunci Provider" : "Tampilkan 8 Kunci Provider Langsung"}
                    </Button>
                  </div>
                </CardHeader>

                {showDirectKeys && (
                  <CardContent className="p-5 space-y-4 divide-y divide-border/40 animate-in fade-in-50 duration-200">
                    
                    {/* 1. Google Gemini */}
                    <div className="space-y-1.5 pt-2 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🔵</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">Google Gemini API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(GOOGLE_GENERATIVE_AI_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('gemini', 'geminiApiKey')}>
                          {showMasks.gemini ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.gemini ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.gemini ? "text" : "password"}
                          value={settings.geminiApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, geminiApiKey: e.target.value }))}
                          placeholder="AIzaSy••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('gemini', settings.geminiApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'gemini' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: Gemini 2.5 Flash, 2.5 Pro, 2.0 Flash, 1.5 Pro</p>
                    </div>

                    {/* 2. Anthropic Claude */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🟤</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">Anthropic Claude API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(ANTHROPIC_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('anthropic', 'anthropicApiKey')}>
                          {showMasks.anthropic ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.anthropic ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.anthropic ? "text" : "password"}
                          value={settings.anthropicApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, anthropicApiKey: e.target.value }))}
                          placeholder="sk-ant-api03-••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('anthropic', settings.anthropicApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'anthropic' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku, Claude 3 Opus</p>
                    </div>

                    {/* 3. OpenAI */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🟢</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">OpenAI API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(OPENAI_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('openai', 'openaiApiKey')}>
                          {showMasks.openai ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.openai ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.openai ? "text" : "password"}
                          value={settings.openaiApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, openaiApiKey: e.target.value }))}
                          placeholder="sk-proj-••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('openai', settings.openaiApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'openai' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: GPT-4o, GPT-4o Mini, o3-mini, o1, GPT-4 Turbo</p>
                    </div>

                    {/* 4. DeepSeek */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🟣</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">DeepSeek API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(DEEPSEEK_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('deepseek', 'deepseekApiKey')}>
                          {showMasks.deepseek ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.deepseek ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.deepseek ? "text" : "password"}
                          value={settings.deepseekApiKey || settings.platformAiApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, deepseekApiKey: e.target.value, platformAiApiKey: e.target.value }))}
                          placeholder="sk-cf74••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('deepseek', settings.deepseekApiKey || settings.platformAiApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'deepseek' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: DeepSeek V3 (Chat), DeepSeek R1 (Reasoner)</p>
                    </div>

                    {/* 5. Groq LPU */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">⚡</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">Groq LPU API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(GROQ_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('groq', 'groqApiKey')}>
                          {showMasks.groq ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.groq ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.groq ? "text" : "password"}
                          value={settings.groqApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, groqApiKey: e.target.value }))}
                          placeholder="gsk_••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('groq', settings.groqApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'groq' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: Llama 3.3 70B Versatile, Llama 3.1 8B Instant, Mixtral 8x7B (300+ t/s)</p>
                    </div>

                    {/* 6. Mistral AI */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🟠</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">Mistral AI API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(MISTRAL_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('mistral', 'mistralApiKey')}>
                          {showMasks.mistral ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.mistral ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.mistral ? "text" : "password"}
                          value={settings.mistralApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, mistralApiKey: e.target.value }))}
                          placeholder="sk_••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('mistral', settings.mistralApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'mistral' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: Codestral 2501 (Code Specialist), Mistral Large 2</p>
                    </div>

                    {/* 7. xAI Grok */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">⬛</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">xAI (Grok) API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(XAI_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('xai', 'xaiApiKey')}>
                          {showMasks.xai ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.xai ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.xai ? "text" : "password"}
                          value={settings.xaiApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, xaiApiKey: e.target.value }))}
                          placeholder="xai-••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('xai', settings.xaiApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'xai' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: Grok 2, Grok 2 Vision</p>
                    </div>

                    {/* 8. OpenRouter */}
                    <div className="space-y-1.5 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🌐</span>
                          <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">OpenRouter API Key</Label>
                          <span className="text-[9px] text-muted-foreground font-mono">(OPENROUTER_API_KEY)</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('openrouter', 'openrouterApiKey')}>
                          {showMasks.openrouter ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.openrouter ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Input 
                          type={showMasks.openrouter ? "text" : "password"}
                          value={settings.openrouterApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, openrouterApiKey: e.target.value }))}
                          placeholder="sk-or-v1-••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono flex-1"
                        />
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="h-9 text-xs rounded-xl px-3 font-semibold"
                          onClick={() => handleTestAi('openrouter', settings.openrouterApiKey)}
                          disabled={testAiLoading}
                        >
                          {testingProvider === 'openrouter' ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tes"}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Model: OpenRouter Auto Best, Qwen 2.5 72B, Llama & 300+ Model Lainnya</p>
                    </div>

                    {/* 9. v0 & Vercel Preview Token */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">🚀</span>
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">v0 by Vercel API Key</Label>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('v0', 'v0ApiKey')}>
                            {showMasks.v0 ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            {showMasks.v0 ? "Sembunyikan" : "Tampilkan"}
                          </Button>
                        </div>
                        <Input 
                          type={showMasks.v0 ? "text" : "password"}
                          value={settings.v0ApiKey}
                          onChange={e => setSettings(prev => ({ ...prev, v0ApiKey: e.target.value }))}
                          placeholder="v1:••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs">▲</span>
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-foreground">Vercel Access Token</Label>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('vercel', 'vercelAccessToken')}>
                            {showMasks.vercel ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            {showMasks.vercel ? "Sembunyikan" : "Tampilkan"}
                          </Button>
                        </div>
                        <Input 
                          type={showMasks.vercel ? "text" : "password"}
                          value={settings.vercelAccessToken}
                          onChange={e => setSettings(prev => ({ ...prev, vercelAccessToken: e.target.value }))}
                          placeholder="vcp_••••••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                      </div>
                    </div>

                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* TAB 2: EMAIL & SMTP DELIVERY */}
            <TabsContent value="email_smtp" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Resend & SMTP Config */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Mail className="h-4 w-4 text-primary" />
                      Konfigurasi Pengiriman Email
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Resend API atau SMTP kustom.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    
                    {/* Resend Section */}
                    <div className="space-y-1.5 p-3.5 bg-muted/20 rounded-xl border border-border/60">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resend API Key (Prioritas Utama)</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('resend', 'resendApiKey')}>
                          {showMasks.resend ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.resend ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <Input
                        type={showMasks.resend ? "text" : "password"}
                        value={settings.resendApiKey}
                        onChange={e => setSettings(prev => ({ ...prev, resendApiKey: e.target.value }))}
                        placeholder="re_••••••••••••••••"
                        className="h-9 rounded-xl text-xs bg-background border-border/80 font-mono"
                      />
                      <div className="space-y-1 pt-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground">Pengirim Resend (From Address)</Label>
                        <Input 
                          value={settings.resendFrom}
                          onChange={e => setSettings(prev => ({ ...prev, resendFrom: e.target.value }))}
                          placeholder="SaCMS <noreply@mail.sacms.cloud>"
                          className="h-9 rounded-xl text-xs bg-background border-border/80"
                        />
                      </div>
                    </div>

                    {/* SMTP Fallback Section */}
                    <div className="space-y-3 p-3.5 bg-muted/20 rounded-xl border border-border/60">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SMTP Fallback Server</Label>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">SMTP Host</Label>
                          <Input 
                            value={settings.smtpHost}
                            onChange={e => setSettings(prev => ({ ...prev, smtpHost: e.target.value }))}
                            placeholder="smtp.gmail.com"
                            className="h-9 rounded-xl text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">SMTP Port</Label>
                          <Input 
                            value={settings.smtpPort}
                            onChange={e => setSettings(prev => ({ ...prev, smtpPort: e.target.value }))}
                            placeholder="587"
                            className="h-9 rounded-xl text-xs bg-background border-border/80"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">SMTP User</Label>
                          <Input 
                            value={settings.smtpUser}
                            onChange={e => setSettings(prev => ({ ...prev, smtpUser: e.target.value }))}
                            placeholder="apikey atau user@domain.com"
                            className="h-9 rounded-xl text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground">SMTP Password</Label>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('smtp', 'smtpPass')}>
                              {showMasks.smtp ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                              {showMasks.smtp ? "Sembunyikan" : "Tampilkan"}
                            </Button>
                          </div>
                          <Input
                            type={showMasks.smtp ? "text" : "password"}
                            value={settings.smtpPass}
                            onChange={e => setSettings(prev => ({ ...prev, smtpPass: e.target.value }))}
                            placeholder="••••••••••••••••"
                            className="h-9 rounded-xl text-xs bg-background border-border/80 font-mono"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <Label className="text-xs text-foreground font-bold">Gunakan SSL/TLS Aman (Port 465)</Label>
                        <Switch 
                          checked={settings.smtpSecure === "true"}
                          onCheckedChange={c => setSettings(prev => ({ ...prev, smtpSecure: c ? "true" : "false" }))}
                        />
                      </div>
                    </div>

                  </CardContent>
                </Card>

                {/* Test Email Delivery */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Send className="h-4 w-4 text-primary" />
                      Uji Coba Pengiriman Email Live
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Verifikasi autentikasi SMTP / Resend.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Penerima Uji Coba</Label>
                      <Input 
                        type="email"
                        value={testEmailRecipient}
                        onChange={e => setTestEmailRecipient(e.target.value)}
                        placeholder="admin@domain.com"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>

                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                      <h4 className="text-xs font-bold text-primary">Informasi Email Otomatis SaCMS</h4>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Digunakan untuk:
                      </p>
                      <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-0.5">
                        <li>Verifikasi alamat email pengguna saat mendaftar</li>
                        <li>Tautan reset kata sandi lupa login</li>
                        <li>Notifikasi tiket customer support dan pembayaran invoice</li>
                      </ul>
                    </div>

                    <Button 
                      onClick={handleTestEmail}
                      disabled={testEmailLoading}
                      className="w-full text-xs font-bold rounded-xl h-9 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {testEmailLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                      {testEmailLoading ? "Mengirim Email Tes..." : "Kirim Email Uji Coba Sekarang"}
                    </Button>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 3: PAYMENT & MIDTRANS */}
            <TabsContent value="billing_payments" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Payment Gateway Midtrans Snap
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kredensial Midtrans untuk QRIS, VA, dan Kartu Kredit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mode Transaksi</Label>
                      <Select 
                        value={settings.midtransMode}
                        onValueChange={v => setSettings(prev => ({ ...prev, midtransMode: v as any }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="sandbox" className="text-xs rounded-lg">Sandbox (Simulasi Pengujian)</SelectItem>
                          <SelectItem value="production" className="text-xs rounded-lg">Production (Pembayaran Asli QRIS / Bank)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Midtrans Server Key</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('midtransServer', 'midtransServerKey')}>
                          {showMasks.midtransServer ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.midtransServer ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <Input 
                        type={showMasks.midtransServer ? "text" : "password"}
                        value={settings.midtransServerKey}
                        onChange={e => setSettings(prev => ({ ...prev, midtransServerKey: e.target.value }))}
                        placeholder="SB-Mid-server-••••••••••••"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Midtrans Client Key</Label>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => toggleMask('midtransClient')}>
                          {showMasks.midtransClient ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {showMasks.midtransClient ? "Sembunyikan" : "Tampilkan"}
                        </Button>
                      </div>
                      <Input 
                        type={showMasks.midtransClient ? "text" : "password"}
                        value={settings.midtransClientKey}
                        onChange={e => setSettings(prev => ({ ...prev, midtransClientKey: e.target.value }))}
                        placeholder="SB-Mid-client-••••••••••••"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                    </div>

                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">Webhook URL Notifikasi</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Masukkan ke Dashboard Midtrans &rarr; Settings &rarr; Notification URL.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payment Webhook URL</Label>
                      <div className="flex gap-2">
                        <Input 
                          readOnly 
                          value="https://developer.sacms.cloud/api/billing/midtrans/webhooks"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-9 rounded-xl text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText("https://developer.sacms.cloud/api/billing/midtrans/webhooks")
                            toast({ title: "Tersalin", description: "Webhook URL Midtrans berhasil disalin." })
                          }}
                        >
                          Salin
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 4: STORAGE & INFRASTRUCTURE */}
            <TabsContent value="storage_infra" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cloudflare R2 */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      Penyimpanan Berkas (Cloudflare R2 / AWS S3)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kredensial S3 Object Storage untuk media upload.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cloudflare R2 Account ID</Label>
                      <Input 
                        value={settings.r2AccountId}
                        onChange={e => setSettings(prev => ({ ...prev, r2AccountId: e.target.value }))}
                        placeholder="contoh: c8b9e6f••••••••••••"
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Access Key ID</Label>
                        <Input 
                          value={settings.r2AccessKeyId}
                          onChange={e => setSettings(prev => ({ ...prev, r2AccessKeyId: e.target.value }))}
                          placeholder="AKIA••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-bold text-muted-foreground">Secret Access Key</Label>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => revealSecret('r2Secret', 'r2SecretAccessKey')}>
                            {showMasks.r2Secret ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            {showMasks.r2Secret ? "Sembunyikan" : "Tampilkan"}
                          </Button>
                        </div>
                        <Input
                          type={showMasks.r2Secret ? "text" : "password"}
                          value={settings.r2SecretAccessKey}
                          onChange={e => setSettings(prev => ({ ...prev, r2SecretAccessKey: e.target.value }))}
                          placeholder="••••••••••••"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 font-mono"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Bucket Name</Label>
                        <Input 
                          value={settings.r2BucketName}
                          onChange={e => setSettings(prev => ({ ...prev, r2BucketName: e.target.value }))}
                          placeholder="sacms-media"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-muted-foreground">Public CDN URL</Label>
                        <Input 
                          value={settings.r2PublicUrl}
                          onChange={e => setSettings(prev => ({ ...prev, r2PublicUrl: e.target.value }))}
                          placeholder="https://media.sacms.cloud"
                          className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 5: WORKSPACE & REGISTRATION */}
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
                      Tenant global untuk data publik platform.
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
                          onClick={generateTenantId}
                          className="text-xs font-bold rounded-xl border-border/80 h-9 shrink-0"
                        >
                          <RefreshCw className="mr-1.5 h-3 w-3 text-muted-foreground" />
                          Acak Baru
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* User Registration & Plan */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">Registrasi & Kebijakan Domain</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Batasan hak akses saat registrasi akun baru.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mode Registrasi Akun</Label>
                      <Select 
                        value={settings.registrationMode} 
                        onValueChange={v => setSettings(prev => ({ ...prev, registrationMode: v as any }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="open" className="text-xs rounded-lg">Terbuka untuk Umum (Open Signup)</SelectItem>
                          <SelectItem value="invite_only" className="text-xs rounded-lg">Hanya Melalui Undangan (Invite Only)</SelectItem>
                          <SelectItem value="closed" className="text-xs rounded-lg">Pendaftaran Ditutup (Closed)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kebijakan Custom Domain</Label>
                      <Select 
                        value={settings.customDomainPolicy} 
                        onValueChange={v => setSettings(prev => ({ ...prev, customDomainPolicy: v as any }))}
                      >
                        <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="paid_only" className="text-xs rounded-lg">Hanya Tenant Berlangganan Berbayar (Pro/Enterprise)</SelectItem>
                          <SelectItem value="all_plans" className="text-xs rounded-lg">Semua Paket Termasuk Free Plan</SelectItem>
                          <SelectItem value="disabled" className="text-xs rounded-lg">Nonaktifkan Custom Domain</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 6: KEAMANAN & RUNTIME */}
            <TabsContent value="security" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Maintenance & Rate Limit */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                      <Shield className="h-4 w-4 text-primary" />
                      Mode Pemeliharaan & Rate Limit
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Kendali akses global dan rate limit API.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between p-3.5 bg-muted/20 border border-border/60 rounded-xl">
                      <div className="space-y-0.5">
                        <Label className="text-xs font-bold text-foreground">Mode Pemeliharaan (Maintenance)</Label>
                        <p className="text-[11px] text-muted-foreground">Kunci akses tenant saat maintenance terjadwal</p>
                      </div>
                      <Switch 
                        checked={settings.maintenanceMode === "true"}
                        onCheckedChange={c => setSettings(prev => ({ ...prev, maintenanceMode: c ? "true" : "false" }))}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pesan Pemeliharaan</Label>
                      <Input 
                        value={settings.maintenanceMessage}
                        onChange={e => setSettings(prev => ({ ...prev, maintenanceMessage: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Rate Limit Global (Request / Menit)</Label>
                      <Input 
                        type="number"
                        value={settings.apiRateLimitPerMinute}
                        onChange={e => setSettings(prev => ({ ...prev, apiRateLimitPerMinute: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Log Retention */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">Retensi Log</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Log lebih lama dari batas ini terhapus otomatis oleh cron harian.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retensi Audit Log (Hari)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={settings.auditLogRetentionDays}
                        onChange={e => setSettings(prev => ({ ...prev, auditLogRetentionDays: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Retensi API Request Log (Hari)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={settings.apiLogRetentionDays}
                        onChange={e => setSettings(prev => ({ ...prev, apiLogRetentionDays: e.target.value }))}
                        className="h-9 rounded-xl text-xs bg-muted/20 border-border/80"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Edge Cache Purge */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">Edge & Redis Cache Flushing</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Bersihkan cache respon API dan setting platform.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Menghapus cache Redis untuk rate-limit, domain mapping, dan pricing.
                    </p>
                    <Button 
                      variant="destructive"
                      onClick={handlePurgeCache}
                      disabled={purgingCache}
                      className="w-full text-xs font-bold rounded-xl h-9"
                    >
                      {purgingCache ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                      {purgingCache ? "Membersihkan Cache..." : "Purge All Edge & Redis Cache"}
                    </Button>
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
