"use client"

import { useState, useEffect, useMemo } from "react"
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
  Copy, Activity, BarChart2, Maximize2, Minimize2, Code2, Folder, FileCode,
  ChevronDown, ChevronUp, ChevronRight, History, Play, RotateCw,
  CreditCard, Calendar, Flame, HardDrive
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
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

export const QUICK_ITERATION_SUGGESTIONS = [
  { label: "🌙 Tambah Dark Mode Toggle", prompt: "Tambahkan toggle switch Dark Mode / Light Mode di navbar dengan transisi halus." },
  { label: "🔍 Tambah Filter & Search", prompt: "Tambahkan kolom pencarian real-time dan filter kategori berbasis tab pada katalog." },
  { label: "📅 Tambah Modal Booking", prompt: "Tambahkan dialog modal formulir reservasi/booking lengkap dengan tanggal dan input kontak." },
  { label: "⭐ Tambah Testimonial", prompt: "Tambahkan seksi testimoni klien/pelanggan dengan rating bintang 5 dan foto avatar." },
  { label: "💳 Tambah Checkout WhatsApp", prompt: "Tambahkan tombol checkout instan yang otomatis mengarahkan pesanan ke WhatsApp admin." },
  { label: "🌐 Hubungkan Live API", prompt: "Pastikan seluruh data komponen mengambil data live dari SaCMS Public REST API." },
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

  // Generation Mode: 'instant' | 'safe'
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
  
  // v0.dev Clone Studio Multi-Tab View ("preview" | "code" | "console")
  const [activeViewerTab, setActiveViewerTab] = useState<"preview" | "code" | "console">("preview")
  const [isReasoningOpen, setIsReasoningOpen] = useState(true)
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  
  // Generated Multi-File Code Tree
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ name: string; content: string }>>([
    {
      name: "app/page.tsx",
      content: `"use client"

import React, { useState } from "react"
import { Globe, ArrowRight, Star, ShieldCheck, Zap, Sparkles, Search, ChevronRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold">S</div>
          <span className="font-extrabold text-base">SaCMS Digital Experience</span>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-black text-white">Website Next.js 16 Aktif</h1>
        <p className="mt-4 text-slate-400 max-w-2xl mx-auto">Terkoneksi langsung ke database SaCMS Headless CMS.</p>
      </main>
    </div>
  )
}`
    },
    {
      name: "components/Navbar.tsx",
      content: `export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="font-extrabold text-white">Brand Logo</div>
      </div>
    </header>
  )
}`
    },
    {
      name: "lib/sacms.ts",
      content: `export const SACMS_API_URL = process.env.NEXT_PUBLIC_SACMS_API || "/api/public"

export async function fetchContent(collection: string) {
  const res = await fetch(\`\${SACMS_API_URL}/content/\${collection}\`, {
    next: { revalidate: 60 }
  })
  return res.json()
}`
    }
  ])

  // Version History Trail
  const [versionHistory, setVersionHistory] = useState<Array<{
    version: number
    prompt: string
    timestamp: string
    previewUrl: string
  }>>([
    {
      version: 1,
      prompt: initialProject?.frontendPrompt || "Initial website generation",
      timestamp: "Sekarang",
      previewUrl: initialProject?.previewUrl || "",
    }
  ])
  const [activeVersionNumber, setActiveVersionNumber] = useState<number>(1)

  // Console / Terminal Logs Stream
  const [consoleLogs, setConsoleLogs] = useState<Array<{ id: string; time: string; type: "info" | "success" | "warn"; text: string }>>([
    { id: "1", time: "00:00:01", type: "info", text: "Ready in 420ms (Next.js 16.0.0 App Router)" },
    { id: "2", time: "00:00:02", type: "success", text: "Connected to SaCMS MCP Server & Public Content API" },
    { id: "3", time: "00:00:03", type: "info", text: "Compiled / (app/page.tsx) with Tailwind CSS v4 in 120ms" },
    { id: "4", time: "00:00:04", type: "success", text: "GET /api/public/content - 200 OK (38ms)" },
  ])

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Chat message stream
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai', content: string; files?: any[] }>>([
    { 
      role: 'ai', 
      content: initialProject?.v0ChatId 
        ? "Selamat datang kembali di SaCMS AI Studio. Website Anda siap diuji pada Live Sandbox di sebelah kanan. Tuliskan revisi atau instruksi tambahan kapan saja!" 
        : "Halo! Saya adalah SaCMS AI Assistant. Ketik kebutuhan website Anda di bawah, dan saya akan otomatis merancang skema database, mock content, serta mengompilasi frontend Next.js App Router."
    }
  ])
  const [iterationPrompt, setIterationPrompt] = useState("")

  // Deploy to Vercel state
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentInfo, setDeploymentInfo] = useState<any>(null)
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)

  // 1-Year Managed Cloud Hosting state
  const [hostingInfo, setHostingInfo] = useState<{ isHostingActive: boolean; hostingStatus: string; hostingExpiresAt: string | null } | null>(null)
  const [isHostingModalOpen, setIsHostingModalOpen] = useState(false)
  const [selectedHostingPlan, setSelectedHostingPlan] = useState<"hosting_annual_1yr" | "hosting_bundle_domain_1yr">("hosting_bundle_domain_1yr")
  const [isProcessingHostingPayment, setIsProcessingHostingPayment] = useState(false)

  const fetchHostingStatus = async () => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`)
      if (res.ok) {
        const data = await res.json()
        setHostingInfo(data)
        return data
      }
    } catch (e) {
      console.error("Failed to fetch hosting status:", e)
    }
    return null
  }

  useEffect(() => {
    fetchHostingStatus()
  }, [tenantSlug])

  // Custom Domain state
  const [customDomainInput, setCustomDomainInput] = useState("")
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false)
  const [customDomainResult, setCustomDomainResult] = useState<any>(null)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)

  // Delete project state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // ESC key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  // Copy code helper
  const handleCopyCurrentCode = () => {
    const activeFile = generatedFiles[selectedFileIndex]
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content)
      setCopiedCode(true)
      toast({ title: "Kode Disalin", description: `${activeFile.name} telah disalin ke clipboard.` })
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

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
  const handleGenerateWebsite = async (promptToUse?: string, schemaToUse?: any) => {
    const prompt = (promptToUse || mainPrompt).trim()
    if (!prompt) return

    const requiredCredits = currentModelConfig.credits
    if (!isUnlimited && creditsRemaining < requiredCredits) {
      toast({
        variant: "destructive",
        title: "AI Credit Tidak Mencukupi",
        description: `Dibutuhkan ${requiredCredits} Credits untuk model ${currentModelConfig.name}. Silakan top up di halaman Billing.`,
      })
      router.push(`/dashboard/${tenantSlug}/subscriptions`)
      return
    }

    // Close plan modal if open
    setIsPlanModalOpen(false)
    setLoading(true)
    setLoadingStep("Fase 1/2: Menganalisa & membuat Content Types via SaCMS MCP...")

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/generate-frontend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedModel,
          apiBaseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
          plannedSchema: schemaToUse || schemaPlan || null,
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

      if (data.files && Array.isArray(data.files) && data.files.length > 0) {
        setGeneratedFiles(data.files)
      }

      // Add to version history
      const newVer = {
        version: 1,
        prompt: prompt,
        timestamp: new Date().toLocaleTimeString(),
        previewUrl: data.previewUrl,
      }
      setVersionHistory([newVer])
      setActiveVersionNumber(1)

      // Add console logs
      setConsoleLogs(prev => [
        ...prev,
        { id: Date.now().toString(), time: new Date().toLocaleTimeString(), type: "success", text: `[Build] Generated Next.js 16 App Router application for ${prompt.substring(0, 30)}...` }
      ])

      setMessages([
        { role: 'user', content: prompt },
        { 
          role: 'ai', 
          content: `✅ **Website & Skema Database Berhasil Dibangun!**\n\n1. **SaCMS MCP Engine:** Skema database Content Types dan mock entri data otomatis dibuat di database PostgreSQL.\n2. **SaCMS AI Studio (${currentModelConfig.name}):** Kode frontend Next.js App Router telah selesai di-generate dan terhubung ke SaCMS Content API.\n\nAnda dapat melihat Live Interactive Preview di tab **Preview**, melihat & menyalin kode di tab **Code**, atau memantau proses di tab **Console**.` 
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
  const handleIterate = async (customPrompt?: string) => {
    const msg = (customPrompt || iterationPrompt).trim()
    if (!msg || !v0ChatId) return

    if (!isUnlimited && creditsRemaining < 5) {
      toast({
        variant: "destructive",
        title: "AI Credit Habis",
        description: "Saldo credit AI tidak mencukupi untuk iterasi desain (5 Credits).",
      })
      return
    }

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
        setMessages(prev => [...prev, { role: 'ai', content: `✨ Desain website telah diperbarui untuk: "${msg}". Preview dan file kode telah disinkronkan.` }])
        if (data.previewUrl) setPreviewUrl(data.previewUrl)
        if (data.files && Array.isArray(data.files) && data.files.length > 0) {
          setGeneratedFiles(data.files)
        }

        // Add version
        const nextVerNum = versionHistory.length + 1
        setVersionHistory(prev => [
          ...prev,
          {
            version: nextVerNum,
            prompt: msg,
            timestamp: new Date().toLocaleTimeString(),
            previewUrl: data.previewUrl || previewUrl,
          }
        ])
        setActiveVersionNumber(nextVerNum)

        setConsoleLogs(prev => [
          ...prev,
          { id: Date.now().toString(), time: new Date().toLocaleTimeString(), type: "success", text: `[Fast Refresh] Recompiled v${nextVerNum} for: ${msg.substring(0, 30)}...` }
        ])
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
  // Deploy to Vercel Handler with 1-Year Cloud Hosting Gateway
  // ────────────────────────────────────────────────────────────────────────────
  const loadSnapScript = async () => {
    if (typeof window !== "undefined" && (window as any).snap) return true
    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script")
      script.src = "https://app.sandbox.midtrans.com/snap/snap.js"
      script.setAttribute("data-client-key", "SB-Mid-client-demo")
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const handleDeployToVercel = async () => {
    // 1. Check hosting status first
    const statusData = await fetchHostingStatus()
    if (statusData && !statusData.isHostingActive) {
      setIsHostingModalOpen(true)
      return
    }
    await handleExecuteDeploy()
  }

  const handleExecuteDeploy = async () => {
    setIsDeploying(true)
    try {
      const isVps = Boolean(hostingInfo?.hasDedicatedVps)
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "deploy", 
          target: isVps ? "vps" : "auto",
          chatId: v0ChatId 
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setProjectStatus("project")
        setDeploymentInfo(data)
        setIsDeployModalOpen(true)
        toast({ 
          title: isVps ? "Deploy ke Dedicated VPS Berhasil!" : "Deploy ke Cloud Berhasil!", 
          description: `Website produksi aktif di: ${data.url || "Cloud Edge"}` 
        })
      } else {
        throw new Error(data?.error || "Gagal deploy ke cloud")
      }
    } catch (err: any) {
      toast({ title: "Deploy Gagal", description: err.message, variant: "destructive" })
    } finally {
      setIsDeploying(false)
    }
  }

  const handleCheckoutHosting = async () => {
    setIsProcessingHostingPayment(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: selectedHostingPlan,
          tenantId: tenantId,
          interval: "year",
          type: "workspace"
        })
      })

      const data = await res.json()
      if (!res.ok || !data.token) {
        throw new Error(data.error || "Gagal menginisialisasi pembayaran Midtrans")
      }

      await loadSnapScript()

      if (typeof window !== "undefined" && (window as any).snap) {
        (window as any).snap.pay(data.token, {
          onSuccess: async () => {
            toast({ title: "Pembayaran Berhasil!", description: "Cloud Hosting 1 Tahun telah aktif. Memulai proses deployment..." })
            setIsHostingModalOpen(false)
            await fetchHostingStatus()
            handleExecuteDeploy()
          },
          onPending: () => {
            toast({ title: "Menunggu Pembayaran", description: "Silakan selesaikan pembayaran untuk mengaktifkan hosting." })
          },
          onError: () => {
            toast({ variant: "destructive", title: "Pembayaran Gagal", description: "Transaksi tidak dapat diselesaikan." })
          },
          onClose: () => {
            setIsProcessingHostingPayment(false)
          }
        })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Checkout Error", description: err.message })
    } finally {
      setIsProcessingHostingPayment(false)
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
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              SaCMS AI Website Studio
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Enterprise AI Studio
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Bangun, uji secara live, dan deploy website Next.js 16 full-stack dengan integrasi SaCMS MCP Server & Public Content API.
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
            onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
            className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-7 rounded-lg shrink-0"
          >
            <Zap className="h-3 w-3 mr-1 fill-black" />
            Top Up di Billing
          </Button>
        </div>
      )}

      {/* ── MAIN STUDIO AREA ── */}
      {loading && !v0ChatId ? (
        /* ── Loading Animation Stage ── */
        <div className="border border-border/80 rounded-2xl p-12 flex flex-col items-center justify-center flex-1 gap-6 text-center bg-card shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center animate-pulse border border-primary/20">
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
        /* ── v0.dev Dual-Pane Interactive Studio ── */
        <div className={`flex flex-col flex-1 border border-border/80 rounded-2xl overflow-hidden bg-background shadow-xs transition-all ${
          isFullscreen 
            ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 p-3 bg-background" 
            : "min-h-[750px]"
        }`}>
          {/* Studio Action Bar */}
          <div className="h-12 border-b border-border/60 flex items-center justify-between px-4 bg-muted/30 shrink-0">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">SaCMS Live Studio</span>
              
              {/* Version History Selector Pills */}
              <div className="flex items-center gap-1 bg-background/80 border border-border/80 rounded-lg p-0.5 ml-2">
                <History className="h-3 w-3 text-muted-foreground ml-1.5" />
                {versionHistory.map((ver) => (
                  <button
                    key={ver.version}
                    onClick={() => {
                      setActiveVersionNumber(ver.version)
                      if (ver.previewUrl) setPreviewUrl(ver.previewUrl)
                    }}
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-all ${
                      activeVersionNumber === ver.version
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    v{ver.version}
                  </button>
                ))}
              </div>

              {/* Status Badge */}
              <Badge 
                variant="outline" 
                className={`text-[10px] font-bold ${
                  projectStatus === "project" 
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" 
                    : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                }`}
              >
                {projectStatus === "project" ? "PRODUCTION" : "DRAFT"}
              </Badge>

              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-500 bg-emerald-500/10 hidden sm:inline-flex">
                MCP Connected
              </Badge>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-2">
              {/* Tab Switcher: Preview | Code | Console */}
              <div className="flex items-center bg-muted p-0.5 rounded-xl border border-border/60">
                <button
                  onClick={() => setActiveViewerTab("preview")}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeViewerTab === "preview"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Monitor className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setActiveViewerTab("code")}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeViewerTab === "code"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Code</span>
                </button>
                <button
                  onClick={() => setActiveViewerTab("console")}
                  className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    activeViewerTab === "console"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Console</span>
                </button>
              </div>

              {/* Fullscreen Button */}
              <Button
                variant={isFullscreen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="gap-1.5 h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-muted"
                title={isFullscreen ? "Keluar Fullscreen (Esc)" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5 text-primary" /> : <Maximize2 className="h-3.5 w-3.5 text-primary" />}
                <span className="hidden md:inline">{isFullscreen ? "Keluar" : "Fullscreen"}</span>
              </Button>

              {/* Download Starter ZIP Action */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/api/tenant/${tenantSlug}/ai-builder/export-starter`, '_blank')}
                className="gap-1.5 h-8 text-xs font-bold rounded-xl border-border/80 hover:bg-muted"
                title="Unduh Source Code Next.js 16 siap jalan"
              >
                <Download className="h-3.5 w-3.5 text-primary" /> Unduh ZIP
              </Button>

              {/* 1-Click Deploy ke VPS / Cloud */}
              <Button 
                variant="default" 
                size="sm" 
                onClick={handleDeployToVercel} 
                disabled={isDeploying}
                className={cn(
                  "gap-1.5 h-8 text-xs font-bold rounded-xl shadow-xs cursor-pointer",
                  hostingInfo?.hasDedicatedVps
                    ? "bg-purple-600 hover:bg-purple-700 text-white border border-purple-500/30"
                    : "bg-primary text-primary-foreground"
                )}
                title={hostingInfo?.hasDedicatedVps ? "Deploy langsung ke Dedicated VPS Anda (Rp 0 Biaya)" : "Deploy ke Cloud Edge"}
              >
                {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
                {hostingInfo?.hasDedicatedVps ? "Deploy ke VPS (Rp 0)" : "Deploy ke Cloud"}
              </Button>

              {/* Hapus Draft / Project Action */}
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-8 w-8 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
                title="Hapus Project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          {/* Main Studio Body (Split Left & Right) */}
          <div className="flex flex-1 overflow-hidden">
            
            {/* ── LEFT PANE: Chat, Reasoner & Iteration Box ── */}
            <div className="w-80 lg:w-96 border-r border-border/60 flex flex-col bg-muted/20 shrink-0">
              
              {/* Agentic Reasoning Accordion */}
              <div className="border-b border-border/60 bg-background/50 p-2.5">
                <button
                  onClick={() => setIsReasoningOpen(!isReasoningOpen)}
                  className="flex items-center justify-between w-full text-left text-xs font-bold text-foreground hover:text-primary transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-primary" />
                    Agentic Reasoning Pipeline
                  </span>
                  {isReasoningOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {isReasoningOpen && (
                  <div className="mt-2.5 space-y-1.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Analisis Kebutuhan Prompt & Scope</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Query Skema Database via MCP Server</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Scaffold Next.js 16 App Router & Tailwind</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Live Sandbox Verification</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Message Stream */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] font-semibold text-muted-foreground px-1">
                        {msg.role === 'user' ? 'Anda' : 'SaCMS AI Assistant'}
                      </span>
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

              {/* Quick Iteration Chips */}
              <div className="p-2 border-t border-border/60 bg-muted/40 overflow-x-auto">
                <div className="flex items-center gap-1.5 text-[11px] whitespace-nowrap">
                  {QUICK_ITERATION_SUGGESTIONS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleIterate(item.prompt)}
                      disabled={loading}
                      className="px-2.5 py-1 rounded-lg bg-background border border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 text-[10px] font-medium transition-all shadow-2xs cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
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
                    onClick={() => handleIterate()} 
                    disabled={loading || !iterationPrompt.trim() || (creditsRemaining <= 0 && !isUnlimited)}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>

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
            
            {/* ── RIGHT PANE: Multi-Tab Viewer (Preview | Code | Console) ── */}
            <div className="flex-1 bg-muted/10 flex flex-col overflow-hidden">
              
              {activeViewerTab === "preview" && (
                /* ── TAB 1: Live Interactive Preview ── */
                <div className="flex-1 p-3 flex flex-col items-center justify-center overflow-hidden">
                  
                  {/* Viewport Control Bar */}
                  <div className="w-full flex items-center justify-between pb-2 px-1">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-background rounded-lg border border-border/80 p-0.5 shadow-2xs">
                        <Button
                          variant={deviceMode === "desktop" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setDeviceMode("desktop")}
                          className="h-6 w-6 rounded-md"
                          title="Desktop (100%)"
                        >
                          <Monitor className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={deviceMode === "tablet" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setDeviceMode("tablet")}
                          className="h-6 w-6 rounded-md"
                          title="Tablet (768px)"
                        >
                          <Tablet className="h-3 w-3" />
                        </Button>
                        <Button
                          variant={deviceMode === "mobile" ? "secondary" : "ghost"}
                          size="icon"
                          onClick={() => setDeviceMode("mobile")}
                          className="h-6 w-6 rounded-md"
                          title="Mobile (375px)"
                        >
                          <Smartphone className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Mock URL address bar */}
                      <div className="hidden sm:flex items-center gap-2 bg-background border border-border/80 rounded-lg px-3 py-1 text-[11px] font-mono text-muted-foreground max-w-sm truncate shadow-2xs">
                        <Globe className="h-3 w-3 text-primary shrink-0" />
                        <span className="truncate">{previewUrl || "https://sandbox.sacms.cloud"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPreviewUrl(p => p + "#r")} 
                        className="gap-1 h-7 text-xs rounded-lg border-border/80"
                      >
                        <RefreshCw className="h-3 w-3" /> Refresh
                      </Button>
                      {previewUrl && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          asChild 
                          className="gap-1 h-7 text-xs rounded-lg border-border/80"
                        >
                          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" /> Tab Baru
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Frame Container */}
                  <div className={`flex-1 rounded-xl overflow-hidden border border-border/80 shadow-xs bg-background flex flex-col transition-all duration-300 ${
                    deviceMode === "desktop" ? "w-full" : deviceMode === "tablet" ? "w-[768px] max-w-full" : "w-[375px] max-w-full"
                  }`}>
                    {previewUrl ? (
                      <iframe 
                        src={previewUrl} 
                        className="w-full h-full border-0 bg-background" 
                        title="Preview" 
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals" 
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
                        <Monitor className="h-6 w-6 text-muted-foreground" />
                        <p className="text-xs">Preview website sedang disiapkan...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeViewerTab === "code" && (
                /* ── TAB 2: Multi-File Code Editor & Explorer ── */
                <div className="flex flex-1 overflow-hidden">
                  
                  {/* File Tree Explorer (Left) */}
                  <div className="w-56 border-r border-border/60 bg-background/50 p-3 space-y-3 shrink-0 flex flex-col justify-between">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Folder className="h-3.5 w-3.5 text-primary" />
                        Berkas Proyek
                      </span>
                      
                      <div className="space-y-1">
                        {generatedFiles.map((file, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFileIndex(idx)}
                            className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                              selectedFileIndex === idx
                                ? "bg-primary/10 text-primary font-bold border border-primary/20"
                                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            }`}
                          >
                            <FileCode className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{file.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyCurrentCode}
                      className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl border-border/80"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedCode ? "Tersalin!" : "Salin Kode"}</span>
                    </Button>
                  </div>

                  {/* Code Viewer Panel (Right) */}
                  <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-mono text-xs">
                    <div className="h-9 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
                      <span className="text-slate-400 text-xs font-bold">
                        {generatedFiles[selectedFileIndex]?.name || "app/page.tsx"}
                      </span>
                      <span className="text-[10px] text-slate-500">TypeScript / React 19 / Next.js 16</span>
                    </div>

                    <ScrollArea className="flex-1 p-4">
                      <pre className="leading-relaxed whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                        {generatedFiles[selectedFileIndex]?.content}
                      </pre>
                    </ScrollArea>
                  </div>

                </div>
              )}

              {activeViewerTab === "console" && (
                /* ── TAB 3: Terminal & Compilation Stream ── */
                <div className="flex-1 bg-slate-950 text-slate-200 p-4 flex flex-col font-mono text-xs overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-emerald-400" />
                      <span className="font-bold text-white">Next.js Fast Compiler Stream</span>
                    </div>
                    <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                      Live Edge Proxy
                    </Badge>
                  </div>

                  <ScrollArea className="flex-1 pt-3">
                    <div className="space-y-2">
                      {consoleLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3">
                          <span className="text-slate-500 shrink-0">[{log.time}]</span>
                          <span className={log.type === "success" ? "text-emerald-400 font-semibold" : log.type === "warn" ? "text-amber-400" : "text-slate-300"}>
                            {log.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

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

              {/* Model Selection Selector */}
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

          <div className="flex-1 overflow-y-auto p-6 space-y-5 max-h-[calc(88vh-160px)]">
            {schemaPlan?.contentTypes?.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Layers className="h-4 w-4 text-primary" />
                    <span>Koleksi Data (Content Types)</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
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
          </div>

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
              onClick={() => handleGenerateWebsite(schemaPlan?.frontendPrompt || mainPrompt, schemaPlan)}
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
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Hapus {projectStatus === "project" ? "Project" : "Draft"} Website?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tindakan ini akan mereset sesi live sandbox saat ini. Seluruh skema Content Types yang telah dibuat di database tetap aman dan tidak terhapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="rounded-xl text-xs font-bold bg-destructive"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Ya, Hapus Sesi Ini
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DEPLOY SUCCESS MODAL ── */}
      <Dialog open={isDeployModalOpen} onOpenChange={setIsDeployModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Deploy ke Cloud Berhasil!
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aplikasi Next.js Anda kini telah aktif di jaringan cloud edge berkecepatan tinggi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {deploymentInfo?.hostType === "vps" ? (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-600 dark:text-purple-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  <span className="font-bold">Hosted on Dedicated VPS ({deploymentInfo.vpsIp})</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-purple-500/20 border-purple-500/30 text-purple-600 dark:text-purple-300">
                  Rp 0 Biaya Tambahan
                </Badge>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="font-bold">Hosted on SaCMS Cloud Edge Global</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-300">
                  Cloud Active
                </Badge>
              </div>
            )}

            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">URL Produksi:</span>
              <div className="flex items-center justify-between gap-2">
                <a 
                  href={deploymentInfo?.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-bold text-primary hover:underline truncate"
                >
                  {deploymentInfo?.url}
                </a>
                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 cursor-pointer" onClick={() => {
                  navigator.clipboard.writeText(deploymentInfo?.url || "")
                  toast({ title: "URL Disalin" })
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsDeployModalOpen(false)} className="rounded-xl text-xs font-bold">
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── 1-YEAR MANAGED CLOUD HOSTING CHECKOUT MODAL ── */}
      <Dialog open={isHostingModalOpen} onOpenChange={setIsHostingModalOpen}>
        <DialogContent className="sm:max-w-[620px] w-[95vw] max-h-[90vh] flex flex-col rounded-3xl border border-border bg-card p-0 gap-0 overflow-hidden shadow-2xl">
          
          <DialogHeader className="p-6 pb-4 border-b border-border/80 shrink-0 text-left bg-linear-to-b from-primary/10 via-background to-background">
            <div className="flex items-center gap-2 text-primary font-bold text-xs">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Aktivasi Cloud Hosting Produksi (1 Tahun)</span>
            </div>
            <DialogTitle className="text-xl font-black text-foreground pt-1 flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Publikasikan Website ke Cloud Edge
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Website AI Anda siap di-deploy ke jaringan cloud global dengan garansi uptime 99.9%, SSL HTTPS otomatis, dan performa kilat.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[calc(90vh-170px)]">
            
            {/* Hosting Option 1: Standalone Hosting */}
            <div 
              onClick={() => setSelectedHostingPlan("hosting_annual_1yr")}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative",
                selectedHostingPlan === "hosting_annual_1yr"
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                  : "border-border hover:border-border/80 bg-muted/20"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                    selectedHostingPlan === "hosting_annual_1yr" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"
                  )}>
                    {selectedHostingPlan === "hosting_annual_1yr" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground">Managed Cloud Edge Hosting</span>
                    <span className="text-[10px] text-muted-foreground ml-2">(1 Tahun)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-sm text-foreground">Rp 650.000</span>
                  <span className="text-[10px] text-muted-foreground block">/ tahun</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>SaCMS Global Edge Network</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Auto SSL HTTPS & HTTP/3</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>100 GB Bandwidth / bulan</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Garansi Uptime 99.9% SLA</span>
                </div>
              </div>
            </div>

            {/* Hosting Option 2: Bundling with Domain */}
            <div 
              onClick={() => setSelectedHostingPlan("hosting_bundle_domain_1yr")}
              className={cn(
                "p-4 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden",
                selectedHostingPlan === "hosting_bundle_domain_1yr"
                  ? "border-purple-500 bg-purple-500/5 ring-2 ring-purple-500/20 shadow-xs"
                  : "border-border hover:border-border/80 bg-muted/20"
              )}
            >
              <div className="absolute top-0 right-0 bg-linear-to-l from-purple-600 to-indigo-600 text-white text-[9px] font-black px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <Flame className="w-3 h-3" /> Paling Hemat & Praktis
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                    selectedHostingPlan === "hosting_bundle_domain_1yr" ? "border-purple-600 bg-purple-600 text-white" : "border-muted-foreground"
                  )}>
                    {selectedHostingPlan === "hosting_bundle_domain_1yr" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-foreground">Bundling Hosting + Domain .com</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">(1 Tahun Lengkap)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-sm text-purple-600 dark:text-purple-400">Rp 850.000</span>
                  <span className="text-[10px] text-muted-foreground line-through block">Rp 900.000</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Globe className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Gratis 1 Domain Kustom (.com/.id)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>DNS & CNAME Auto-Configured</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>SaCMS Global Edge Network</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Auto SSL HTTPS & Fast CDN</span>
                </div>
              </div>
            </div>

            {/* Info Security Notice */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 text-[11px] text-muted-foreground flex items-start gap-2.5">
              <Shield className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>Pembayaran aman diproses via <strong>Midtrans Payment Gateway</strong> (QRIS, GoPay, BCA/Mandiri/BRI Virtual Account, Kartu Kredit).</span>
            </div>

          </div>

          <DialogFooter className="p-4 px-6 border-t border-border/80 bg-muted/20 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHostingModalOpen(false)}
              className="h-10 text-xs rounded-xl cursor-pointer"
            >
              Nanti Saja
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleCheckoutHosting}
              disabled={isProcessingHostingPayment}
              className="h-10 text-xs font-bold rounded-xl gap-2 bg-primary text-primary-foreground shadow-xs cursor-pointer"
            >
              {isProcessingHostingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Bayar & Aktifkan Hosting ({selectedHostingPlan === "hosting_bundle_domain_1yr" ? "Rp 850.000" : "Rp 650.000"})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
