"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { 
  Sparkles, Rocket, Loader2, Globe,
  Monitor, ExternalLink, RefreshCw, Send, Bot, Database, AlertCircle, Zap,
  Tablet, Smartphone, ArrowRight, CheckCircle2, Cpu, Trash2, Download,
  ShieldCheck, Layers, FileText, Check, LayoutGrid, Key, Shield, Terminal,
  Copy, Activity, BarChart2, Maximize2, Minimize2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import type { DomainBlueprint } from "@/lib/ai/domain-knowledge-types"

interface WebsiteBuilderClientProps {
  tenantId: string
  tenantSlug: string
  hasUpgradedPlan: boolean
  hasSchema?: boolean
  initialAiCredits?: {
    remaining: number
    total: number
    isUnlimited: boolean
  }
  initialProject: {
    v0ChatId: string | null
    previewUrl: string | null
    frontendPrompt: string | null
    status?: "draft" | "project"
    model?: string
  } | null
}

export interface AiModelOption {
  id: string
  name: string
  badge: string
  description: string
  credits: number
  isPopular?: boolean
}

export const AI_MODELS: AiModelOption[] = [
  {
    id: "v0-mini",
    name: "SaCMS AI Mini",
    badge: "Fast & Light",
    description: "Cepat & hemat credit untuk landing page sederhana.",
    credits: 15,
  },
  {
    id: "v0-pro",
    name: "SaCMS AI Pro",
    badge: "Recommended",
    description: "Standar produksi full-stack Next.js dengan data fetching dinamis.",
    credits: 25,
    isPopular: true,
  },
  {
    id: "v0-max",
    name: "SaCMS AI Max",
    badge: "High Reasoning",
    description: "Untuk arsitektur database multi-relasi dan halaman interaktif.",
    credits: 35,
  },
  {
    id: "v0-max-fast",
    name: "SaCMS AI Max Fast",
    badge: "Ultra Fast",
    description: "Performa penalaran tinggi dengan kecepatan generasi kilat.",
    credits: 40,
  },
]

export const QUICK_PROMPT_INSPIRATIONS = [
  {
    icon: "🏖️",
    label: "Resor & Pariwisata",
    prompt: "Buat website modern untuk Grand Resort & Pariwisata dengan katalog tipe kamar (Deluxe, Ocean Villa), paket wisata bahari/diving, fasilitas resto seafood, galeri foto, dan formulir booking reservasi online.",
  },
  {
    icon: "☕",
    label: "Toko Online UMKM",
    prompt: "Buat website toko online e-commerce untuk UMKM produk kopi dan kerajinan tangan, dengan katalog produk filterable, varian berat/ukuran, harga diskon, ulasan bintang, dan checkout WhatsApp instan.",
  },
  {
    icon: "📰",
    label: "Portal Berita & Media",
    prompt: "Rancang portal media berita digital modern dengan kategori topik (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks, headline breaking news, profil jurnalis, dan feed pengumuman publik.",
  },
  {
    icon: "🏥",
    label: "Klinik & Jadwal Dokter",
    prompt: "Buat website profil klinik kesehatan modern dengan jadwal praktik dokter spesialis, direktori layanan medis & poliklinik, artikel kesehatan, dan formulir pendaftaran janji temu pasien.",
  },
  {
    icon: "🎓",
    label: "Sekolah & PPDB Online",
    prompt: "Rancang website institusi sekolah / kejuruan modern dengan profil sekolah, direktori jurusan/program keahlian, pengumuman akademik, galeri prestasi siswa, dan formulir pendaftaran PPDB online.",
  },
  {
    icon: "💼",
    label: "Agensi & Portofolio",
    prompt: "Buat website portofolio agensi digital kreatif ultra-modern sleek dark mode dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, paket pricing harga, dan formulir konsultasi proyek.",
  },
]

export function WebsiteBuilderClient({
  tenantId, tenantSlug, hasUpgradedPlan, initialAiCredits, initialProject
}: WebsiteBuilderClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  
  const creditsRemaining = initialAiCredits?.remaining ?? 0
  const isUnlimited = initialAiCredits?.isUnlimited ?? false

  // Selected AI Model
  const [selectedModel, setSelectedModel] = useState<string>(initialProject?.model || "v0-pro")
  const currentModelConfig = AI_MODELS.find(m => m.id === selectedModel) || AI_MODELS[1]

  // Generation Mode: 'instant' | 'safe' (Two-Stage Recommendation 1)
  const [generationMode, setGenerationMode] = useState<"instant" | "safe">("safe")
  const [schemaPlan, setSchemaPlan] = useState<any | null>(null)
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)

  // Loading state & step
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>("")
  
  // Prompt Input state
  const [mainPrompt, setMainPrompt] = useState(initialProject?.frontendPrompt || "")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  
  // Project & Draft State
  const [v0ChatId, setV0ChatId] = useState(initialProject?.v0ChatId || null)
  const [previewUrl, setPreviewUrl] = useState(initialProject?.previewUrl || "")
  const [projectStatus, setProjectStatus] = useState<"draft" | "project">(initialProject?.status || "draft")
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  
  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Deploy & Domain Cockpit Modal State
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [deploymentInfo, setDeploymentInfo] = useState<{
    url?: string
    state?: string
    deploymentId?: string
    vercelProjectId?: string
    apiKeyName?: string
  } | null>(null)
  const [customDomainInput, setCustomDomainInput] = useState("")
  const [customDomainResult, setCustomDomainResult] = useState<any | null>(null)
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false)

  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>(
    initialProject?.frontendPrompt 
      ? [
          { role: 'user', content: initialProject.frontendPrompt },
          { role: 'ai', content: 'Website frontend berhasil dibangun oleh SaCMS AI Engine dan terkoneksi langsung ke database SaCMS via MCP.' }
        ]
      : []
  )
  const [iterationPrompt, setIterationPrompt] = useState("")
  const [isDeploying, setIsDeploying] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Fullscreen keyboard listener (Escape key to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  // 0-credit warning on mount
  useEffect(() => {
    if (!isUnlimited && creditsRemaining <= 0) {
      toast({
        variant: "destructive",
        title: "AI Credit Habis (0 Credits)",
        description: "Saldo AI credit Anda saat ini 0. Silakan top up credit di halaman Billing.",
      })
    }
  }, [creditsRemaining, isUnlimited, toast])

  // ────────────────────────────────────────────────────────────────────────────
  // Plan Schema (Two-Stage Safe Mode Handler)
  // ────────────────────────────────────────────────────────────────────────────
  const handlePlanSchema = async (customPrompt?: string, templateId?: string) => {
    const prompt = (customPrompt || mainPrompt).trim()
    if (!prompt && !templateId) return

    setIsPlanning(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/plan-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, templateId })
      })

      const data = await res.json()
      if (res.ok && data.plan) {
        setSchemaPlan(data.plan)
        setIsPlanModalOpen(true)
      } else {
        throw new Error(data?.error || "Gagal merencanakan skema.")
      }
    } catch (err: any) {
      toast({
        title: "Gagal Merencanakan Skema",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setIsPlanning(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Unified Generate Website Handler
  // ────────────────────────────────────────────────────────────────────────────
  const handleGenerateWebsite = async (promptToUse?: string) => {
    const prompt = (promptToUse || mainPrompt).trim()
    if (!prompt) return

    const requiredCredits = currentModelConfig.credits
    if (!isUnlimited && creditsRemaining < requiredCredits) {
      toast({
        variant: "destructive",
        title: "AI Credit Tidak Mencukupi",
        description: `Dibutuhkan ${requiredCredits} Credits untuk model ${currentModelConfig.name}. Silakan top up di halaman Billing.`,
      })
      router.push("/dashboard/billing")
      return
    }

    // Close plan modal if open
    setIsPlanModalOpen(false)
    setLoading(true)
    setLoadingStep("Menginspeksi SaCMS MCP & membuat skema database...")

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/generate-frontend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          apiBaseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
        })
      })

      const contentType = res.headers.get("content-type") || ""
      let data: any = null
      if (contentType.includes("application/json")) {
        data = await res.json()
      } else {
        const text = await res.text()
        if (!res.ok) {
          throw new Error(`Permintaan ke server gagal (${res.status}). Silakan coba beberapa saat lagi.`)
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || "Gagal membangun website")
      }

      if (!data?.v0ChatId) {
        throw new Error("Server tidak mengembalikan Chat ID yang valid.")
      }

      setV0ChatId(data.v0ChatId)
      setPreviewUrl(data.previewUrl)
      setProjectStatus("draft")
      setMessages([
        { role: 'user', content: prompt },
        { 
          role: 'ai', 
          content: `✅ **Website & Skema Database Berhasil Dibangun!**\n\n1. **SaCMS MCP Engine:** Skema database Content Types dan mock entri data otomatis dibuat di database PostgreSQL.\n2. **SaCMS AI Studio (${currentModelConfig.name}):** Kode frontend Next.js App Router telah selesai di-generate dan terhubung ke SaCMS Content API.\n\nAnda dapat melihat Live Interactive Preview di panel kanan dan meminta perubahan desain di panel chat ini.` 
        }
      ])
      
      toast({
        title: "Website Berhasil Dibangun!",
        description: "Tampilan live Next.js siap digunakan dan terhubung penuh ke database SaCMS.",
      })
      router.refresh()
    } catch (err: any) {
      console.error(err)
      toast({
        title: "Gagal Membangun Website",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setLoadingStep("")
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Select Pre-baked Template (Domain Knowledge Library)
  // ────────────────────────────────────────────────────────────────────────────
  const handleSelectTemplate = (template: DomainBlueprint) => {
    setSelectedTemplateId(template.id)
    setMainPrompt(template.prompt)
    if (generationMode === "safe") {
      handlePlanSchema(template.prompt, template.id)
    } else {
      toast({
        title: `Template "${template.name}" Dipilih`,
        description: "Tekan tombol 'Bangun Website' untuk mengeksekusi.",
      })
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Iteration Handler (Follow-up chat)
  // ────────────────────────────────────────────────────────────────────────────
  const handleIterate = async () => {
    if (!iterationPrompt.trim() || !v0ChatId) return

    if (!isUnlimited && creditsRemaining < 5) {
      toast({
        variant: "destructive",
        title: "AI Credit Habis",
        description: "Saldo credit AI tidak mencukupi untuk iterasi desain (5 Credits).",
      })
      return
    }

    const msg = iterationPrompt.trim()
    setIterationPrompt("")
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    setLoadingStep("Menerapkan perubahan desain pada antarmuka Next.js...")

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/iterate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: v0ChatId, prompt: msg })
      })

      const contentType = res.headers.get("content-type") || ""
      let data: any = null
      if (contentType.includes("application/json")) {
        data = await res.json()
      }

      if (res.ok && data) {
        setMessages(prev => [...prev, { role: 'ai', content: 'Desain website telah diperbarui sesuai instruksi Anda.' }])
        if (data.previewUrl) setPreviewUrl(data.previewUrl)
      } else {
        throw new Error(data?.error || "Gagal menerapkan iterasi")
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Gagal menerapkan perubahan: ${err.message}` }])
    } finally {
      setLoading(false)
      setLoadingStep("")
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Deploy to Vercel Handler
  // ────────────────────────────────────────────────────────────────────────────
  const handleDeployToVercel = async () => {
    setIsDeploying(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deploy", chatId: v0ChatId })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setProjectStatus("project")
        setDeploymentInfo(data)
        setIsDeployModalOpen(true)
        toast({ 
          title: "Deploy Vercel Berhasil!", 
          description: `Website produksi aktif di: ${data.url || "Vercel"}` 
        })
      } else {
        throw new Error(data?.error || "Gagal deploy ke Vercel")
      }
    } catch (err: any) {
      toast({ title: "Deploy Gagal", description: err.message, variant: "destructive" })
    } finally {
      setIsDeploying(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Custom Domain & CNAME Configuration Handler
  // ────────────────────────────────────────────────────────────────────────────
  const handleConfigureDomain = async () => {
    if (!customDomainInput.trim()) {
      toast({ title: "Domain Diperlukan", description: "Masukkan nama custom domain Anda (contoh: site.mycompany.com)" })
      return
    }
    setIsVerifyingDomain(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "domain", domain: customDomainInput.trim() })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setCustomDomainResult(data)
        toast({ title: "Konfigurasi Domain Berhasil", description: `Domain ${customDomainInput} siap dihubungkan!` })
      } else {
        throw new Error(data.error || "Gagal mengonfigurasi domain")
      }
    } catch (err: any) {
      toast({ title: "Error Domain", description: err.message, variant: "destructive" })
    } finally {
      setIsVerifyingDomain(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Delete Draft / Project Handler
  // ────────────────────────────────────────────────────────────────────────────
  const handleDeleteProject = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })

      const contentType = res.headers.get("content-type") || ""
      let data: any = null
      if (contentType.includes("application/json")) {
        data = await res.json()
      }

      if (res.ok) {
        setV0ChatId(null)
        setPreviewUrl("")
        setMessages([])
        setMainPrompt("")
        setProjectStatus("draft")
        setIsDeleteDialogOpen(false)
        toast({
          title: "Berhasil Dihapus",
          description: `${projectStatus === "project" ? "Project" : "Draft"} website telah berhasil dihapus.`,
        })
        router.refresh()
      } else {
        throw new Error(data?.error || "Gagal menghapus")
      }
    } catch (err: any) {
      toast({
        title: "Gagal Menghapus",
        description: err.message,
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-6 w-full max-w-7xl mx-auto">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 pb-2">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">AI Website Builder</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              SaCMS AI Studio
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Ketik ide website Anda. SaCMS AI Engine akan otomatis merancang skema database via MCP dan membangun frontend Next.js dinamis.
          </p>
        </div>

        {/* AI Credit status */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 bg-card border border-border/80 px-3.5 py-1.5 rounded-xl shadow-xs">
            <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="text-xs font-semibold text-muted-foreground">Saldo AI:</span>
            <span className="text-xs font-black text-foreground">
              {isUnlimited ? "Unlimited" : `${creditsRemaining} Credits`}
            </span>
          </div>
        </div>
      </div>

      {/* ── 0-Credit Warning Banner ── */}
      {!isUnlimited && creditsRemaining <= 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Saldo AI Credit Anda saat ini <strong>0 Credits</strong>. Silakan top up credit untuk menggunakan fitur AI Website Builder.
            </span>
          </div>
          <Button 
            size="sm" 
            onClick={() => router.push('/dashboard/billing')}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-7 rounded-lg shrink-0"
          >
            <Zap className="h-3 w-3 mr-1 fill-black" />
            Top Up di Billing
          </Button>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      {loading && !v0ChatId ? (
        /* ── Loading Animation Stage ── */
        <div className="border border-border/80 rounded-2xl p-12 flex flex-col items-center justify-center flex-1 gap-6 text-center bg-card shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-lg font-black text-foreground">
              {loadingStep || "Sedang memproses instruksi Anda..."}
            </h2>
            <p className="text-muted-foreground text-xs leading-relaxed">
              AI sedang menginspeksi skema database SaCMS via MCP, membuat tipe konten baru, dan mengompilasi antarmuka Next.js App Router.
            </p>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary mt-2" />
        </div>
      ) : v0ChatId ? (
        /* ── Live Preview & Interactive Chat Studio ── */
        <div className={`flex flex-col flex-1 border border-border/80 rounded-2xl overflow-hidden bg-background shadow-xs transition-all ${
          isFullscreen 
            ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 p-3 bg-background" 
            : "min-h-[700px]"
        }`}>
          {/* Header Bar */}
          <div className="h-12 border-b border-border/60 flex items-center justify-between px-4 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-bold text-foreground">Live Interactive Sandbox</span>
              
              {/* Draft / Project Status Badge */}
              <Badge 
                variant="outline" 
                className={`text-[10px] font-bold ${
                  projectStatus === "project" 
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" 
                    : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                }`}
              >
                {projectStatus === "project" ? "PROJECT" : "DRAFT"}
              </Badge>

              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hidden sm:inline-flex">
                MCP Connected
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-medium hidden md:inline-flex">
                {currentModelConfig.name}
              </Badge>

              {isFullscreen && (
                <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground hidden xl:inline-flex bg-muted/50">
                  Tekan ESC untuk keluar
                </Badge>
              )}
            </div>

            {/* Responsive Device Mode Toggles */}
            <div className="hidden sm:flex items-center bg-muted p-0.5 rounded-lg border border-border/60 gap-0.5">
              <Button
                variant={deviceMode === "desktop" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDeviceMode("desktop")}
                className="h-7 w-7 rounded-md"
                title="Desktop (100%)"
              >
                <Monitor className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={deviceMode === "tablet" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDeviceMode("tablet")}
                className="h-7 w-7 rounded-md"
                title="Tablet (768px)"
              >
                <Tablet className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={deviceMode === "mobile" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setDeviceMode("mobile")}
                className="h-7 w-7 rounded-md"
                title="Mobile (375px)"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Preview Toolbar Action Buttons */}
            <div className="flex items-center gap-2">
              {/* Fullscreen Toggle Button */}
              <Button
                variant={isFullscreen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="gap-1.5 h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-muted transition-all"
                title={isFullscreen ? "Keluar dari Layar Penuh (Esc)" : "Mode Layar Penuh (Fullscreen)"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-primary" /> : <Maximize2 className="h-3.5 w-3.5 text-primary" />}
                <span className="hidden md:inline">{isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}</span>
              </Button>

              <Button variant="outline" size="sm" onClick={() => setPreviewUrl(p => p + "#r")} className="gap-1.5 h-8 text-xs rounded-xl border-border/80">
                <RefreshCw className="h-3 w-3" /> Refresh
              </Button>

              {/* Download Starter ZIP Action (Recommendation 3) */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/api/tenant/${tenantSlug}/ai-builder/export-starter`, '_blank')}
                className="gap-1.5 h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-muted"
                title="Unduh Source Code Next.js 16 siap jalan"
              >
                <Download className="h-3.5 w-3.5 text-primary" /> Unduh ZIP
              </Button>

              {/* Hapus Draft / Project Action */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-1.5 h-8 text-xs font-semibold rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Hapus {projectStatus === "project" ? "Project" : "Draft"}
              </Button>

              {previewUrl && (
                <>
                  <Button variant="outline" size="sm" asChild className="gap-1.5 h-8 text-xs rounded-xl border-border/80">
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" /> Buka Tab Baru
                    </a>
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    onClick={handleDeployToVercel} 
                    disabled={isDeploying}
                    className="gap-1.5 h-8 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
                  >
                    {isDeploying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                    Deploy ke Vercel
                  </Button>
                </>
              )}
            </div>
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Chat Sidebar (Left) */}
            <div className="w-80 lg:w-96 border-r border-border/60 flex flex-col bg-muted/20 shrink-0">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] font-semibold text-muted-foreground px-1">{msg.role === 'user' ? 'Anda' : 'SaCMS AI Assistant'}</span>
                      <div className={`px-3.5 py-2 rounded-2xl max-w-[90%] text-xs leading-relaxed whitespace-pre-wrap shadow-xs ${
                        msg.role === 'user' 
                          ? 'bg-primary text-primary-foreground rounded-br-xs font-medium' 
                          : 'bg-card border border-border/60 text-card-foreground rounded-bl-xs'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex flex-col gap-1.5 items-start">
                      <span className="text-[10px] font-semibold text-muted-foreground px-1">SaCMS AI Assistant</span>
                      <div className="px-3.5 py-2 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5 rounded-bl-xs shadow-xs">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">{loadingStep || "Menyesuaikan kode frontend..."}</span>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-3 bg-background border-t border-border/60 shrink-0 space-y-2">
                <div className="relative flex items-end gap-2 bg-background rounded-xl border border-border/80 p-1 shadow-xs focus-within:ring-1 focus-within:ring-primary">
                  <Textarea
                    placeholder={creditsRemaining <= 0 && !isUnlimited ? "Saldo AI habis. Silakan top up..." : "Minta revisi desain ke SaCMS AI..."}
                    value={iterationPrompt}
                    onChange={e => setIterationPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleIterate()
                      }
                    }}
                    disabled={loading || (creditsRemaining <= 0 && !isUnlimited)}
                    className="min-h-[38px] max-h-[200px] resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent py-2 text-xs"
                  />
                  <Button 
                    size="icon" 
                    className="h-8 w-8 shrink-0 rounded-lg mb-0.5 mr-0.5 bg-primary"
                    onClick={handleIterate} 
                    disabled={loading || !iterationPrompt.trim() || (creditsRemaining <= 0 && !isUnlimited)}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Credit Status Below Chat Box */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                    Biaya iterasi: 5 Credits
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Terkoneksi ke REST API SaCMS
                  </span>
                </div>
              </div>
            </div>
            
            {/* Live Preview Frame (Right) */}
            <div className="flex-1 bg-muted/10 p-3 flex flex-col overflow-auto items-center justify-center">
              <div className={`flex-1 rounded-xl overflow-hidden border border-border/80 shadow-xs bg-background flex flex-col transition-all duration-300 ${
                deviceMode === "desktop" ? "w-full" : deviceMode === "tablet" ? "w-[768px] max-w-full" : "w-[375px] max-w-full"
              }`}>
                {previewUrl ? (
                  <iframe src={previewUrl} className="w-full h-full border-0 bg-background" title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
                    <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center shadow-xs">
                      <Monitor className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-bold text-xs text-foreground">Siap Membangun Website</p>
                      <p className="text-[11px]">Tulis instruksi di panel kiri dan tekan Kirim.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── UNIFIED PROMPT-DRIVEN AI ARCHITECTURE STUDIO ── */
        <div className={`flex flex-col transition-all ${
          isFullscreen 
            ? "fixed inset-0 z-50 w-screen h-screen bg-background p-4 md:p-6 overflow-auto" 
            : "gap-6"
        }`}>

          {/* ── MAIN PROMPT & ARCHITECTURE STUDIO CARD ── */}
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs p-6 md:p-8 space-y-6">
            
            {/* Header Title & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">
                  <Database className="h-3.5 w-3.5" />
                  SaCMS MCP Server + Autonomous AI Architecture Engine
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                  Jelaskan Ide Website Anda
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
                  Ketik ide atau kebutuhan sistem website Anda. SaCMS MCP Server akan secara otomatis merancang skema database (koleksi Content Types & Single Types), mengisi dummy data, dan mengompilasi kode frontend Next.js App Router.
                </p>
              </div>

              {/* Action Controls: Fullscreen & Safe Mode Toggle */}
              <div className="flex items-center gap-2 self-start md:self-auto shrink-0 flex-wrap">
                <Button
                  variant={isFullscreen ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="gap-1.5 h-9 text-xs font-bold rounded-xl border-border/80 hover:bg-muted transition-all cursor-pointer"
                  title={isFullscreen ? "Keluar dari Layar Penuh (Esc)" : "Mode Layar Penuh (Fullscreen)"}
                >
                  {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-primary" /> : <Maximize2 className="h-3.5 w-3.5 text-primary" />}
                  <span>{isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}</span>
                </Button>

                {/* Safe Mode Toggle */}
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/80">
                  <button
                    type="button"
                    onClick={() => setGenerationMode("safe")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      generationMode === "safe" 
                        ? "bg-card text-foreground shadow-xs border border-primary/40 ring-1 ring-primary/20" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Mode Aman (Tinjau Skema)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenerationMode("instant")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      generationMode === "instant" 
                        ? "bg-card text-foreground shadow-xs border border-primary/40 ring-1 ring-primary/20" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    Mode Instan
                  </button>
                </div>
              </div>
            </div>

            {/* ── API TOKEN PERMISSION SCOPE INFO BANNER ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-2xl bg-muted/30 border border-border text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                  <Globe className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-foreground font-bold text-[11px]">API Token: Read-Only</strong>
                    <Badge variant="orange" className="text-[9px] px-1.5 py-0 h-4">Frontend Publik</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    AI mengompilasi website frontend publik berkecepatan tinggi dengan data fetching dinamis dari Public Content API.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 border-t md:border-t-0 md:border-l border-border pt-2.5 md:pt-0 md:pl-3">
                <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5 border border-primary/20">
                  <Key className="h-3.5 w-3.5" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-foreground font-bold text-[11px]">API Token: Read & Write</strong>
                    <Badge variant="orange" className="text-[9px] px-1.5 py-0 h-4">Frontend + CMS CRUD</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    AI mengompilasi website publik sekaligus antarmuka CMS / form CRUD terpisah untuk pengelolaan konten langsung.
                  </p>
                </div>
              </div>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">Instruksi / Prompt Kebutuhan Website:</span>
                  <span className="text-[11px] text-muted-foreground">Ketik ide kustom bebas atau pilih contoh kilat di bawah</span>
                </div>
                <Textarea 
                  placeholder="Contoh: Buat website resort pariwisata modern dengan katalog tipe kamar (Deluxe, Ocean Villa), paket diving wisata bahari, fasilitas restoran seafood, galeri foto, dan formulir reservasi online..."
                  className="resize-none min-h-[140px] text-xs md:text-sm rounded-2xl border-border/80 bg-background p-4 focus-visible:ring-primary leading-relaxed shadow-xs"
                  value={mainPrompt}
                  onChange={e => setMainPrompt(e.target.value)}
                />
              </div>

              {/* Quick Inspiration Chips */}
              <div className="space-y-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-primary" /> Ide Cepat (Klik untuk menyalin):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {QUICK_PROMPT_INSPIRATIONS.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMainPrompt(item.prompt)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/60 transition-all text-muted-foreground cursor-pointer"
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── MODEL SELECTION SELECTOR ── */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  <span>Pilih Model AI Engine:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {AI_MODELS.map((m) => {
                    const isSelected = selectedModel === m.id
                    return (
                      <div
                        key={m.id}
                        onClick={() => setSelectedModel(m.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 text-left relative ${
                          isSelected
                            ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary"
                            : "bg-background border-border/80 hover:border-primary/40"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-foreground">{m.name}</span>
                            <Badge 
                              variant={isSelected ? "default" : "outline"} 
                              className={`text-[9px] px-1.5 py-0 h-4 font-mono font-bold ${
                                isSelected ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                              }`}
                            >
                              {m.badge}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-tight">{m.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
                          <span className="font-semibold text-primary">{m.credits} Credits</span>
                          {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/60">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span>
                    {generationMode === "safe" 
                      ? "Mode Aman: Verifikasi skema database sebelum generasi kode frontend"
                      : "Mode Instan: Otomatis eksekusi skema & bangun frontend langsung"}
                  </span>
                </div>

                <Button 
                  size="lg"
                  className="gap-2 font-bold text-xs md:text-sm rounded-xl bg-primary text-primary-foreground shadow-xs h-11 px-6"
                  onClick={() => {
                    if (generationMode === "safe") {
                      handlePlanSchema(mainPrompt)
                    } else {
                      handleGenerateWebsite()
                    }
                  }} 
                  disabled={loading || isPlanning || !mainPrompt.trim() || (!isUnlimited && creditsRemaining < currentModelConfig.credits)}
                >
                  {isPlanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Merancang Skema Database...
                    </>
                  ) : generationMode === "safe" ? (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Tinjau Skema & Bangun (-{currentModelConfig.credits} Credits)
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4" /> Bangun Instan (-{currentModelConfig.credits} Credits)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TWO-STAGE SCHEMA PLAN REVIEW MODAL ── */}
      <Dialog open={isPlanModalOpen} onOpenChange={setIsPlanModalOpen}>
        <DialogContent className="sm:max-w-[720px] w-[95vw] max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card p-0 gap-0 overflow-hidden shadow-2xl">
          
          {/* Fixed Header */}
          <DialogHeader className="p-6 pb-4 border-b border-border/80 shrink-0 text-left">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Verifikasi Rencana Skema Database (Safe Mode)</span>
            </div>
            <DialogTitle className="text-xl font-black text-foreground pt-1">
              {schemaPlan?.title || "Perencanaan Skema AI"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              {schemaPlan?.summary || "Periksa struktur koleksi, relasi, dan field sebelum AI mengompilasi kode frontend ke database."}
            </DialogDescription>
          </DialogHeader>

          {/* Smooth Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 max-h-[calc(88vh-160px)]">
            
            {/* Content Types List */}
            {schemaPlan?.contentTypes?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Koleksi Data (Content Types)</span>
                  </div>
                  <Badge variant="orange" className="text-[10px]">
                    {schemaPlan.contentTypes.length} Koleksi
                  </Badge>
                </div>

                <div className="space-y-3">
                  {schemaPlan.contentTypes.map((ct: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{ct.name}</span>
                          <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded-md text-muted-foreground border border-border/40">
                            {ct.slug}
                          </code>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {ct.fields?.length || 0} Fields
                        </Badge>
                      </div>

                      {ct.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{ct.description}</p>
                      )}

                      {/* Fields Tags */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daftar Fields:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {ct.fields?.map((f: any, fIdx: number) => (
                            <span key={fIdx} className="text-xs font-mono bg-background border border-border/80 px-2.5 py-1 rounded-lg text-foreground inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="font-semibold">{f.name}</span>
                              <span className="text-[10px] text-primary font-bold">({f.type})</span>
                              {f.required && <span className="text-[9px] text-destructive font-black" title="Wajib">*</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single Types List */}
            {schemaPlan?.singleTypes?.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    <span>Single Types (Halaman Tunggal)</span>
                  </div>
                  <Badge variant="orange" className="text-[10px]">
                    {schemaPlan.singleTypes.length} Single
                  </Badge>
                </div>

                <div className="space-y-3">
                  {schemaPlan.singleTypes.map((st: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-muted/30 border border-border space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{st.name}</span>
                          <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded-md text-muted-foreground border border-border/40">
                            {st.slug}
                          </code>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {st.fields?.length || 0} Fields
                        </Badge>
                      </div>

                      {st.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{st.description}</p>
                      )}

                      {/* Fields Tags */}
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daftar Fields:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {st.fields?.map((f: any, fIdx: number) => (
                            <span key={fIdx} className="text-xs font-mono bg-background border border-border/80 px-2.5 py-1 rounded-lg text-foreground inline-flex items-center gap-1.5 shadow-2xs">
                              <span className="font-semibold">{f.name}</span>
                              <span className="text-[10px] text-primary font-bold">({f.type})</span>
                              {f.required && <span className="text-[9px] text-destructive font-black" title="Wajib">*</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Fixed Footer */}
          <DialogFooter className="p-4 px-6 border-t border-border/80 bg-muted/20 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPlanModalOpen(false)}
              className="h-10 text-xs rounded-xl cursor-pointer"
            >
              Ubah / Koreksi Prompt
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => handleGenerateWebsite(schemaPlan?.frontendPrompt || mainPrompt)}
              disabled={loading}
              className="h-10 text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground shadow-xs cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Setujui & Bangun Website (-{currentModelConfig.credits} Credits)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DELETE DRAFT / PROJECT CONFIRMATION DIALOG ── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Hapus {projectStatus === "project" ? "Project" : "Draft"} Website?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
              Tindakan ini akan menghapus seluruh berkas virtual frontend, riwayat chat, dan pengaturan website untuk workspace ini. Anda akan kembali ke menu perancangan awal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="h-8 text-xs rounded-xl"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="h-8 text-xs font-bold rounded-xl gap-1.5"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Ya, Hapus {projectStatus === "project" ? "Project" : "Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── VERCEL DEPLOY & DOMAIN COCKPIT DIALOG ── */}
      <Dialog open={isDeployModalOpen} onOpenChange={setIsDeployModalOpen}>
        <DialogContent className="sm:max-w-[680px] w-[95vw] max-h-[88vh] flex flex-col rounded-2xl border border-border bg-card p-0 gap-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border/80 shrink-0 text-left bg-muted/20">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <Rocket className="h-4 w-4 text-primary" />
              <span>Pusat Kendali Produksi Vercel & Domain</span>
            </div>
            <DialogTitle className="text-xl font-black text-foreground pt-1 flex items-center justify-between">
              <span>Website Berhasil Dipublikasikan</span>
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs font-mono">
                ONLINE READY
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Website Anda telah aktif di server Vercel dan terhubung secara langsung ke Headless CMS SaCMS via MCP.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-muted/40 border border-border/80 p-1 rounded-xl">
                <TabsTrigger value="overview" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5" /> Ringkasan Deploy
                </TabsTrigger>
                <TabsTrigger value="domain" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> Custom Domain
                </TabsTrigger>
                <TabsTrigger value="monitoring" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Monitoring & API
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: OVERVIEW & LIVE URL */}
              <TabsContent value="overview" className="space-y-4 pt-4 mt-0">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Alamat URL Produksi (Vercel):
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={deploymentInfo?.url || `https://sacms-${tenantSlug}.vercel.app`}
                      className="font-mono text-xs h-9 bg-background border-border/80 rounded-xl"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
                      onClick={() => {
                        const url = deploymentInfo?.url || `https://sacms-${tenantSlug}.vercel.app`
                        navigator.clipboard.writeText(url)
                        toast({ title: "Tersalin ke Clipboard", description: url })
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" /> Salin
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 px-4 rounded-xl text-xs font-bold shrink-0 bg-primary text-primary-foreground"
                      onClick={() => {
                        const url = deploymentInfo?.url || `https://sacms-${tenantSlug}.vercel.app`
                        window.open(url, "_blank")
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Buka
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Framework & Runtime:</span>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-primary" /> Next.js 16 (App Router)
                    </span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                    <span className="text-[10px] text-muted-foreground font-semibold block">Project ID:</span>
                    <span className="text-xs font-mono text-foreground truncate block">
                      {deploymentInfo?.vercelProjectId || `prj_sacms_${tenantSlug}`}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* TAB 2: CUSTOM DOMAIN & CNAME */}
              <TabsContent value="domain" className="space-y-4 pt-4 mt-0">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">Tautkan Custom Domain (CNAME / A Record)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="contoh: website.perusahaan.com atau mybrand.id"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      className="text-xs h-9 bg-background border-border/80 rounded-xl"
                    />
                    <Button
                      size="sm"
                      onClick={handleConfigureDomain}
                      disabled={isVerifyingDomain || !customDomainInput.trim()}
                      className="h-9 px-4 rounded-xl text-xs font-bold shrink-0 bg-primary text-primary-foreground"
                    >
                      {isVerifyingDomain ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Globe className="h-3.5 w-3.5 mr-1" />}
                      Tautkan Domain
                    </Button>
                  </div>
                </div>

                {/* DNS Instruction Guide */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/80 space-y-3">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Konfigurasi DNS di Registrar Domain Anda:
                  </span>
                  
                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-background border border-border/60 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-primary font-bold mr-2">CNAME</span>
                        <span className="text-muted-foreground">Host: <code>@ / subdomain</code></span>
                      </div>
                      <code className="text-foreground font-bold bg-muted px-2 py-0.5 rounded">cname.vercel-dns.com</code>
                    </div>

                    <div className="p-2.5 rounded-xl bg-background border border-border/60 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-emerald-500 font-bold mr-2">A Record</span>
                        <span className="text-muted-foreground">Host: <code>@</code></span>
                      </div>
                      <code className="text-foreground font-bold bg-muted px-2 py-0.5 rounded">76.76.21.21</code>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Setelah menambahkan record DNS di penyedia domain Anda, proses propagasi global biasanya memerlukan waktu 1–15 menit.
                  </p>
                </div>
              </TabsContent>

              {/* TAB 3: MONITORING & API GATEWAY */}
              <TabsContent value="monitoring" className="space-y-4 pt-4 mt-0">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 text-center">
                    <span className="text-[10px] text-muted-foreground font-semibold">Uptime Status</span>
                    <p className="text-sm font-black text-emerald-500">100%</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 text-center">
                    <span className="text-[10px] text-muted-foreground font-semibold">Rata-rata Latensi</span>
                    <p className="text-sm font-black text-primary">~28 ms</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-1 text-center">
                    <span className="text-[10px] text-muted-foreground font-semibold">Edge Caching</span>
                    <p className="text-sm font-black text-foreground">Aktif (ISR)</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-bold text-foreground">API Token & Hak Akses MCP</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Website terhubung dengan token berizin <code>read, write</code> untuk query data konten publik dan mutasi formulir.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="p-4 px-6 border-t border-border/80 bg-muted/20 shrink-0 flex justify-end">
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsDeployModalOpen(false)}
              className="h-9 px-5 text-xs font-bold rounded-xl"
            >
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
