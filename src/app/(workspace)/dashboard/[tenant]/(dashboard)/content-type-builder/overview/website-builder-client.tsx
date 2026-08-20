"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { 
  Sparkles, Rocket, Loader2, Globe,
  Monitor, ExternalLink, RefreshCw, Send, Bot, Database, AlertCircle, Zap,
  Tablet, Smartphone, ArrowRight, CheckCircle2, Cpu, Trash2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

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

const QUICK_PROMPT_SUGGESTIONS = [
  {
    title: "Website Hotel & Resor Nabire",
    desc: "Katalog tipe kamar, harga per malam, fasilitas resor, galeri, dan formulir booking.",
    prompt: "Buat website modern untuk Grand Resort Nabire dengan halaman Beranda, Pilihan Kamar (Deluxe, Suite, Villa), Fasilitas Kolam Renang & Resto Seafood, Galeri, dan Form Reservasi Booking."
  },
  {
    title: "Toko Online Kerajinan Papua",
    desc: "Katalog produk Noken kulit kayu, kopi Moanemani, kerajinan ukir, dan keranjang belanja.",
    prompt: "Buat website e-commerce modern untuk Papua Craft Store menjual Noken asli kulit kayu Nabire, Kopi Arabika Moanemani, dan Batik Cenderawasih lengkap dengan keranjang belanja dan checkout."
  },
  {
    title: "Portal Berita & Media Digital",
    desc: "Artikel berita terkini, kategori berita, profil jurnalis, ulasan, dan langganan newsletter.",
    prompt: "Buat portal berita digital modern Nabire News Network dengan kategori Otomotif, Politik, Budaya, showcase artikel unggulan, dan form newsletter."
  }
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

  // Loading state & step
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>("")
  
  // Prompt Input state
  const [mainPrompt, setMainPrompt] = useState(initialProject?.frontendPrompt || "")
  
  // Project & Draft State
  const [v0ChatId, setV0ChatId] = useState(initialProject?.v0ChatId || null)
  const [previewUrl, setPreviewUrl] = useState(initialProject?.previewUrl || "")
  const [projectStatus, setProjectStatus] = useState<"draft" | "project">(initialProject?.status || "draft")
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  
  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
    if (!v0ChatId) return
    setIsDeploying(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: v0ChatId })
      })

      const contentType = res.headers.get("content-type") || ""
      let data: any = null
      if (contentType.includes("application/json")) {
        data = await res.json()
      }

      if (res.ok && data) {
        setProjectStatus("project")
        if (data.url) { 
          toast({ title: "Deployment Dimulai!", description: `Website Anda sedang di-deploy ke Vercel: ${data.url}` })
        }
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
              SaCMS AI Engine
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
        <div className="flex flex-col flex-1 min-h-[700px] border border-border/80 rounded-2xl overflow-hidden bg-background shadow-xs">
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
              <Button variant="outline" size="sm" onClick={() => setPreviewUrl(p => p + "#r")} className="gap-1.5 h-8 text-xs rounded-xl border-border/80">
                <RefreshCw className="h-3 w-3" /> Refresh
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
        /* ── UNIFIED AI STUDIO PROMPT INTERFACE ── */
        <div className="flex flex-col gap-6">
          <div className="rounded-3xl bg-card border border-border/80 shadow-xs p-6 md:p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-xs font-semibold text-primary">
                <Database className="h-3.5 w-3.5" />
                SaCMS MCP Server + Autonomous AI Architecture Engine
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                Apa website yang ingin Anda bangun hari ini?
              </h2>
              <p className="text-xs md:text-sm text-muted-foreground max-w-3xl leading-relaxed">
                Jelaskan konsep website Anda. AI akan otomatis memeriksa skema database SaCMS melalui MCP Tools, membuat tabel yang belum ada, dan langsung meng-generate aplikasi Next.js interaktif.
              </p>
            </div>

            {/* Prompt Textarea */}
            <div className="space-y-4">
              <Textarea 
                placeholder="Contoh: Buat website modern untuk Grand Resort Nabire dengan katalog kamar (Deluxe, Suite), fasilitas resor, galeri foto, dan formulir reservasi booking kamar..."
                className="resize-none min-h-[160px] text-xs md:text-sm rounded-2xl border-border/80 bg-background p-4 focus-visible:ring-primary leading-relaxed shadow-xs"
                value={mainPrompt}
                onChange={e => setMainPrompt(e.target.value)}
              />

              {/* ── MODEL SELECTION SELECTOR ── */}
              <div className="space-y-2 pt-1">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  <span>MCP Server Aktif: Otomatis membuat Content Types & Mock Data</span>
                </div>

                <Button 
                  size="lg"
                  className="gap-2 font-bold text-xs md:text-sm rounded-xl bg-primary text-primary-foreground shadow-xs h-11 px-6"
                  onClick={() => handleGenerateWebsite()} 
                  disabled={loading || !mainPrompt.trim() || (!isUnlimited && creditsRemaining < currentModelConfig.credits)}
                >
                  <Rocket className="h-4 w-4" /> Bangun Website dengan {currentModelConfig.name} (-{currentModelConfig.credits} Credits)
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Prompt Ideas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ide Cepat / Template Prompt
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {QUICK_PROMPT_SUGGESTIONS.map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    setMainPrompt(item.prompt)
                  }}
                  className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 hover:shadow-xs transition-all cursor-pointer space-y-2.5 group flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono text-primary font-semibold">Klik untuk gunakan &rarr;</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
    </div>
  )
}
