"use client"

import { useState, useEffect, useRef, useMemo } from "react"
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
  CreditCard, Calendar, Flame, HardDrive, Server,
  Plus, Star, ArrowUp, PanelLeft, MoreHorizontal, X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import type { DomainBlueprint } from "@/lib/ai/domain-knowledge-types"
import { SandpackPreview } from "@/components/ai-builder/sandpack-preview"
import { ModelPicker } from "@/components/ai-builder/model-picker"
import { CodeViewer } from "@/components/ai-builder/code-viewer"
import { ConsoleViewer, type ConsoleLogEntry } from "@/components/ai-builder/console-viewer"
import { ChatPanel } from "@/components/ai-builder/chat-panel"
import { PreviewPanel } from "@/components/ai-builder/preview-panel"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { AI_MODEL_REGISTRY, type AiModelConfig } from "@/lib/ai/model-registry"

interface WebsiteBuilderClientProps {
  tenantId: string
  tenantSlug: string
  hasUpgradedPlan: boolean
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
    /** The last-generated site's real files, if any were persisted to SiteFile. */
    files?: { name: string; content: string }[] | null
    messages?: any[] | null
  } | null
}

// Model list is now imported from @/lib/ai/model-registry (AI_MODEL_REGISTRY)
// All models use the same unified AI SDK pipeline — no more v0/Claude split.

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
  { label: "🌐 Hubungkan Live API", prompt: "Hubungkan seluruh komponen website ke SaCMS Public REST API dan tampilkan data real dari database skema SaCMS (koleksi kamar, paket tour, dan konfigurasi beranda) dengan data fallback lengkap agar tidak ada komponen yang kosong atau blank." },
  { label: "🌙 Tambah Dark Mode Toggle", prompt: "Tambahkan toggle switch Dark Mode / Light Mode di navbar dengan transisi halus." },
  { label: "🔍 Tambah Filter & Search", prompt: "Tambahkan kolom pencarian real-time dan filter kategori berbasis tab pada katalog." },
  { label: "📅 Tambah Modal Booking", prompt: "Tambahkan dialog modal formulir reservasi/booking lengkap dengan tanggal dan input kontak." },
  { label: "⭐ Tambah Testimonial", prompt: "Tambahkan seksi testimoni klien/pelanggan dengan rating bintang 5 dan foto avatar." },
  { label: "💳 Tambah Checkout WhatsApp", prompt: "Tambahkan tombol checkout instan yang otomatis mengarahkan pesanan ke WhatsApp admin." },
]

export function WebsiteBuilderClient({
  tenantId, tenantSlug, hasUpgradedPlan, initialAiCredits, initialProject
}: WebsiteBuilderClientProps) {
  const { toast } = useToast()
  const router = useRouter()
  
  // Kept as live state (not a pure derived constant) so it can be refreshed
  // after a generate/iterate call without a full page reload — otherwise the
  // "Saldo AI" badge stays at its page-load value even after credits are spent.
  const [creditsRemaining, setCreditsRemaining] = useState(initialAiCredits?.remaining ?? 0)
  const [isUnlimited, setIsUnlimited] = useState(initialAiCredits?.isUnlimited ?? false)

  const refreshCredits = async () => {
    try {
      const res = await fetch("/api/ai/account-credits")
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.creditsRemaining === "number") setCreditsRemaining(data.creditsRemaining)
      if (typeof data.isUnlimited === "boolean") setIsUnlimited(data.isUnlimited)
    } catch {
      // Non-critical — the badge just keeps its last known value.
    }
  }

  // Selected AI Model — now uses the multi-provider registry instead of v0-only models
  const [selectedModel, setSelectedModel] = useState<string>(initialProject?.model || "gpt-4o")
  const currentModelConfig = AI_MODEL_REGISTRY.find(m => m.id === selectedModel) || AI_MODEL_REGISTRY[0]


  // Loading state & step
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<string>("")
  
  // Prompt Input state
  const [mainPrompt, setMainPrompt] = useState(initialProject?.frontendPrompt || "")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [showMcpHint, setShowMcpHint] = useState(true)

  // Project & Draft State
  const [v0ChatId, setV0ChatId] = useState(initialProject?.v0ChatId || null)
  const [previewUrl, setPreviewUrl] = useState(initialProject?.previewUrl || "")
  // Claude builds have no hosted sandbox/preview URL — they're rendered
  // in-browser via Sandpack using the generated files directly (mock data,
  // not a live server — see components/ai-builder/sandpack-preview.tsx).
  const isClaudeBuild = typeof v0ChatId === "string" && v0ChatId.startsWith("sacms_claude_")
  const [projectStatus, setProjectStatus] = useState<"draft" | "project">(initialProject?.status || "draft")
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  // Bumped to force a real iframe remount on Refresh — a URL hash change alone
  // doesn't reliably reload iframe content across browsers.
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0)
  
  // v0.dev Clone Studio Multi-Tab View ("preview" | "code" | "console")
  const [activeViewerTab, setActiveViewerTab] = useState<"preview" | "code" | "console">("preview")
  const [isReasoningOpen, setIsReasoningOpen] = useState(true)
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  
  // Generated Multi-File Code Tree — hydrated from the last-generated site's
  // real SiteFile rows when available (see page.tsx), so the Code tab
  // survives a page reload instead of always resetting to the demo files.
  const DEMO_FILES: Array<{ name: string; content: string }> = [
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
  ]
  const [generatedFiles, setGeneratedFiles] = useState<Array<{ name: string; content: string }>>(
    initialProject?.files && initialProject.files.length > 0 ? initialProject.files : DEMO_FILES
  )

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
  const [iterationPrompt, setIterationPrompt] = useState("")

  // Helper to parse generated Next.js files from stream response
  const parseFilesFromText = (rawText: string): Array<{ name: string; content: string }> => {
    let text = rawText.trim()
    if (text.startsWith("```json")) text = text.replace(/^```json/, "").replace(/```\s*$/, "").trim()
    else if (text.startsWith("```")) text = text.replace(/^```/, "").replace(/```\s*$/, "").trim()

    const jsonStart = text.indexOf("{")
    const jsonEnd = text.lastIndexOf("}")
    if (jsonStart >= 0 && jsonEnd > jsonStart) text = text.substring(jsonStart, jsonEnd + 1)

    try {
      const parsed = JSON.parse(text)
      const rawFiles = Array.isArray(parsed?.files) ? parsed.files : []
      return rawFiles
        .filter((f: any) => f && typeof f.name === "string" && typeof f.content === "string")
        .map((f: any) => ({ name: f.name, content: f.content }))
    } catch {
      return []
    }
  }

  // Helper to extract text from AI SDK UIMessage or legacy message
  const extractMessageText = (msg: any): string => {
    if (!msg) return ""
    if (typeof msg.content === "string") return msg.content
    if (Array.isArray(msg.parts)) {
      return msg.parts
        .filter((p: any) => p && (p.type === "text" || !p.type) && typeof p.text === "string")
        .map((p: any) => p.text)
        .join("")
    }
    return ""
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Unified AI SDK useChat Hook (Multi-Provider: OpenAI, Anthropic, Google)
  // ────────────────────────────────────────────────────────────────────────────
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/tenant/${tenantSlug}/ai-builder/chat`,
        body: {
          modelId: selectedModel,
          isIteration: generatedFiles.length > 0 && generatedFiles !== DEMO_FILES,
          previousFiles: generatedFiles,
        },
      }),
    [tenantSlug, selectedModel, generatedFiles]
  )

  const {
    messages: aiMessages,
    sendMessage,
    status: aiChatStatus,
    setMessages: setAiMessages,
  } = useChat({
    transport,
    onFinish: (event: any) => {
      setLoading(false)
      setLoadingStep("")
      const msg = event?.message ?? event
      const text = extractMessageText(msg)
      const files = parseFilesFromText(text)
      if (files.length > 0) {
        setGeneratedFiles(files)
        setConsoleLogs((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString(),
            type: "success",
            text: `[Build] Generated Next.js 16 App Router application (${files.length} files).`,
          },
        ])
        toast({
          title: "Website Berhasil Dibangun!",
          description: "Pratinjau lokal siap diuji dengan data contoh.",
        })
      }
      const nextVerNum = versionHistory.length + 1
      setActiveVersionNumber(nextVerNum)
      setVersionHistory((prev) => [
        ...prev,
        {
          version: nextVerNum,
          prompt: mainPrompt || iterationPrompt || "Website update",
          timestamp: new Date().toLocaleTimeString(),
          previewUrl: previewUrl,
        },
      ])
      refreshCredits()
      router.refresh()
    },
    onError: (err: any) => {
      setLoading(false)
      setLoadingStep("")
      toast({
        variant: "destructive",
        title: "Gagal Membangun Website",
        description: err?.message || "AI Engine gagal merespons.",
      })
    },
  })

  const isAiChatLoading = aiChatStatus === "streaming" || aiChatStatus === "submitted"

  // Synchronize loading states
  useEffect(() => {
    if (isAiChatLoading) {
      setLoading(true)
      setLoadingStep(
        v0ChatId
          ? "Menerapkan perubahan desain pada antarmuka Next.js..."
          : "Menganalisa prompt & membangun skema CMS dinamis via SaCMS MCP..."
      )
    }
  }, [isAiChatLoading, v0ChatId])

  // Map messages to user/assistant format for UI
  const displayMessages: Array<{ role: "user" | "assistant"; content: string }> =
    aiMessages.length === 0
      ? [
          {
            role: "assistant",
            content: initialProject?.v0ChatId
              ? "Selamat datang kembali di SaCMS AI Studio. Website Anda siap diuji pada Live Sandbox di sebelah kanan. Tuliskan revisi atau instruksi tambahan kapan saja!"
              : "Halo! Saya adalah SaCMS AI Assistant. Ketik kebutuhan website Anda di bawah, dan saya akan otomatis merancang skema database, mock content, serta mengompilasi frontend Next.js App Router.",
          },
        ]
      : aiMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => {
            const content = extractMessageText(m)
            if (m.role === "assistant" && content.includes('"files"')) {
              const files = parseFilesFromText(content)
              if (files.length > 0) {
                return {
                  role: "assistant" as const,
                  content: `✅ **Website Next.js 16 Berhasil Dibuat (${files.length} Berkas)**\n\nKomponen frontend telah dikompilasi dan terhubung ke skema SaCMS. Buka tab **Preview** untuk melihat tampilan interaktif atau tab **Code** untuk meninjau struktur berkas.`,
                }
              }
            }
            return {
              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
              content,
            }
          })

  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll chat history to latest message when messages or loading state change
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [displayMessages, loading, loadingStep])

  // Deploy to Vercel state
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentInfo, setDeploymentInfo] = useState<any>(null)
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)

  // 1-Year Managed Cloud Hosting state
  const [hostingInfo, setHostingInfo] = useState<{
    isHostingActive: boolean
    hostingStatus: string
    hostingExpiresAt: string | null
    hasDedicatedVps: boolean
    hostingTarget: "vercel" | "vps"
    isPaid: boolean
    vpsIp: string | null
    vpsServerName: string | null
    vercelDeploymentUrl: string | null
    customDomain: string | null
    plan: string | null
  } | null>(null)
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

  useEffect(() => {
    if (!mainPrompt && typeof window !== "undefined") {
      try {
        const pending = sessionStorage.getItem("sacms_pending_prompt")
        if (pending) {
          setMainPrompt(pending)
          sessionStorage.removeItem("sacms_pending_prompt")
        }
      } catch {}
    }
  }, [mainPrompt])

  // Custom Domain state
  const [customDomainInput, setCustomDomainInput] = useState("")
  const [isVerifyingDomain, setIsVerifyingDomain] = useState(false)
  const [customDomainResult, setCustomDomainResult] = useState<any>(null)
  const [isDomainModalOpen, setIsDomainModalOpen] = useState(false)

  // Delete project state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Schema import/export state
  const [isExportingSchema, setIsExportingSchema] = useState(false)
  const [isImportingSchema, setIsImportingSchema] = useState(false)
  const [pendingImportSchema, setPendingImportSchema] = useState<any | null>(null)
  const [pendingImportFileName, setPendingImportFileName] = useState("")

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

  // "Buka di tab baru" — leaves the SaCMS-proxied iframe entirely, so unlike
  // the embedded preview it gets no benefit from routing through our own
  // /ai-builder/preview/[chatId] proxy. That proxy path is also the *cached*
  // `previewUrl` Setting for any project generated before a live v0 sandbox
  // existed for it (or before this account had one refreshed) — resolving
  // the real hosted URL fresh here means an old project doesn't stay stuck
  // pointing at our own API route forever.
  const handleOpenPreviewInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, "_blank")
    }
  }

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
  // Unified Generate Website Handler (Direct AI SDK Agent Execution)
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
      router.push(`/dashboard/${tenantSlug}/subscriptions?tab=ai-plans`)
      return
    }

    setLoading(true)
    setLoadingStep("Menganalisa prompt & membangun skema CMS dinamis via SaCMS MCP...")

    if (!v0ChatId) {
      setV0ChatId(`sacms_ai_${Date.now()}`)
    }
    setProjectStatus("draft")

    sendMessage({
      text: prompt,
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Iteration Handler (Follow-up chat)
  // ────────────────────────────────────────────────────────────────────────────
  const handleIterate = async (customPrompt?: string) => {
    const msg = (customPrompt || iterationPrompt).trim()
    if (!msg) return

    if (!isUnlimited && creditsRemaining < currentModelConfig.iterationCredits) {
      toast({
        variant: "destructive",
        title: "AI Credit Habis",
        description: `Saldo credit AI tidak mencukupi untuk iterasi desain (${currentModelConfig.iterationCredits} Credits).`,
      })
      return
    }

    setIterationPrompt("")
    setLoading(true)
    setLoadingStep("Menerapkan perubahan desain pada antarmuka Next.js...")

    sendMessage({
      text: msg,
    })
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

    // Free-plan workspaces can't push to production hosting — send them to
    // billing instead of letting the deploy call round-trip and fail.
    if (statusData && statusData.isPaid === false) {
      toast({
        variant: "destructive",
        title: "Perlu Upgrade Paket",
        description: "Deploy ke hosting produksi memerlukan paket berbayar.",
      })
      router.push(`/dashboard/${tenantSlug}/subscriptions`)
      return
    }

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
          chatId: v0ChatId,
          // Without this the deploy route falls back to a generic starter
          // page, silently discarding the actual generated site — matters
          // for every build, but especially for Claude builds, which have
          // no v0-hosted project of their own to deploy from.
          files: generatedFiles,
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        const isSimulated = Boolean(data.simulated || data.hostType === "simulation")
        setProjectStatus("project")
        setDeploymentInfo(data)
        setIsDeployModalOpen(true)
        toast(
          isSimulated
            ? {
                variant: "destructive",
                title: "Deploy Simulasi — Belum Ada Server Nyata",
                description: "Konfigurasikan VPS atau integrasi Vercel untuk deploy produksi sesungguhnya.",
              }
            : {
                title: isVps ? "Deploy ke Dedicated VPS Berhasil!" : "Deploy ke Cloud Berhasil!",
                description: `Website produksi aktif di: ${data.url || "Cloud Edge"}`,
              }
        )
      } else if (res.status === 403 && data?.code === "plan_limit") {
        toast({
          variant: "destructive",
          title: "Perlu Upgrade Paket",
          description: data?.error || "Deploy ke hosting produksi memerlukan paket berbayar.",
        })
        router.push(data?.details?.redirectTo || `/dashboard/${tenantSlug}/subscriptions`)
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
        const isSimulated = Boolean(data.domain?.simulated || data.dns?.simulated)
        const dnsCheckFailed = Boolean(data.dns?.error)
        toast(
          dnsCheckFailed
            ? {
                variant: "destructive",
                title: "Domain Ditambahkan, Cek DNS Gagal",
                description: "Domain berhasil didaftarkan ke Vercel, tapi pengecekan status DNS gagal (bukan berarti DNS Anda salah) — coba refresh status sebentar lagi.",
              }
            : isSimulated
            ? {
                variant: "destructive",
                title: "Domain Belum Benar-Benar Terhubung",
                description: "Integrasi Vercel belum dikonfigurasi — catatan DNS di bawah bersifat contoh, bukan konfigurasi nyata.",
              }
            : { title: "Konfigurasi Domain Berhasil", description: `Domain ${customDomainInput} siap dihubungkan!` }
        )
      } else if (res.status === 403 && data?.code === "plan_limit") {
        toast({
          variant: "destructive",
          title: "Perlu Upgrade Paket",
          description: data?.error || "Custom domain memerlukan paket berbayar.",
        })
        router.push(data?.details?.redirectTo || `/dashboard/${tenantSlug}/subscriptions`)
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
        setAiMessages([])
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

  // ────────────────────────────────────────────────────────────────────────────
  // Export / Import Schema (Content Types, Single Types, Components as JSON)
  // ────────────────────────────────────────────────────────────────────────────
  const importFileInputRef = useRef<HTMLInputElement>(null)

  const handleExportSchema = async () => {
    setIsExportingSchema(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/export-schema`)
      if (!res.ok) throw new Error("Gagal mengambil skema")
      const schema = await res.json()

      const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sacms-schema-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      const total = (schema.contentTypes?.length || 0) + (schema.singleTypes?.length || 0) + (schema.components?.length || 0)
      toast({ title: "Skema Diekspor", description: `${total} struktur (Content Type, Single Type, Komponen) berhasil diunduh.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengekspor Skema", description: err.message })
    } finally {
      setIsExportingSchema(false)
    }
  }

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (typeof parsed !== "object" || parsed === null) throw new Error("Format JSON tidak valid")
      setPendingImportSchema(parsed)
      setPendingImportFileName(file.name)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Berkas Tidak Valid", description: err.message || "Gagal membaca berkas JSON." })
    }
  }

  const handleConfirmImportSchema = async () => {
    if (!pendingImportSchema) return
    setIsImportingSchema(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/import-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: pendingImportSchema }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal mengimpor skema")

      toast({
        title: "Skema Diimpor",
        description: `${data.imported} struktur baru ditambahkan. Struktur dengan slug yang sudah ada dilewati.`,
      })
      setPendingImportSchema(null)
      setPendingImportFileName("")
      router.refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengimpor Skema", description: err.message })
    } finally {
      setIsImportingSchema(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 w-full max-w-full">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 pb-1">
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
            Bangun dan deploy website Next.js dengan AI.
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
            onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions?tab=ai-plans`)}
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
        <div className={`flex flex-col flex-1 min-h-0 border border-border/80 rounded-2xl overflow-hidden bg-background shadow-xs transition-all ${
          isFullscreen
            ? "fixed inset-0 z-50 w-screen h-screen rounded-none border-0 p-3 bg-background"
            : "h-full min-h-[500px]"
        }`}>
          {/* Studio Top Bar — v0.app style: project switcher left, Preview/Code tabs center, Publish right */}
          <div className="h-12 border-b border-border/60 flex items-center justify-between px-3 bg-card shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted"
                title={isFullscreen ? "Keluar Fullscreen (Esc)" : "Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <Star className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium text-foreground truncate max-w-[220px]">{tenantSlug}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ml-1 shrink-0 ${
                  projectStatus === "project"
                    ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                }`}
              >
                {projectStatus === "project" ? "PRODUCTION" : "DRAFT"}
              </Badge>
            </div>

            {/* Center Tab Switcher: Preview | Code | Console */}
            <div className="flex items-center bg-muted p-0.5 rounded-full border border-border/60 shrink-0">
              <button
                onClick={() => setActiveViewerTab("preview")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  activeViewerTab === "preview"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Preview</span>
              </button>
              <button
                onClick={() => setActiveViewerTab("code")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  activeViewerTab === "code"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Code</span>
              </button>
              <button
                onClick={() => setActiveViewerTab("console")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  activeViewerTab === "console"
                    ? "bg-background text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Console</span>
              </button>
            </div>

            {/* Right Action Tools */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Download Starter ZIP Action */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(`/api/tenant/${tenantSlug}/ai-builder/export-starter`, '_blank')}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                title="Unduh Source Code Next.js 16 siap jalan"
              >
                <Download className="h-3.5 w-3.5" />
              </Button>

              {/* Export Schema JSON */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleExportSchema}
                disabled={isExportingSchema}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                title="Ekspor skema Content Type, Single Type & Komponen sebagai JSON"
              >
                {isExportingSchema ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCode className="h-3.5 w-3.5" />}
              </Button>

              {/* Import Schema JSON */}
              <input
                ref={importFileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportFileSelected}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => importFileInputRef.current?.click()}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                title="Impor skema Content Type, Single Type & Komponen dari JSON"
              >
                <Folder className="h-3.5 w-3.5" />
              </Button>

              {/* Hubungkan Custom Domain — hanya setelah project sudah pernah di-deploy */}
              {projectStatus === "project" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsDomainModalOpen(true)}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                  title="Hubungkan domain kustom ke website ini"
                >
                  <Globe className="h-3.5 w-3.5" />
                </Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsDeleteDialogOpen(true)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                title="Hapus Project"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled
                className="h-8 text-xs font-semibold rounded-full border-border/80 hidden sm:inline-flex"
                title="Undang kolaborator (segera hadir)"
              >
                Invite
              </Button>

              {/* 1-Click Deploy ke VPS / Cloud — restyled as v0.app's black "Publish" button */}
              <Button
                size="sm"
                onClick={handleDeployToVercel}
                disabled={isDeploying}
                className="gap-1.5 h-8 text-xs font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-xs cursor-pointer px-3.5"
                title={hostingInfo?.hasDedicatedVps ? "Deploy langsung ke Dedicated VPS Anda (Rp 0 Biaya)" : "Deploy ke Cloud Edge"}
              >
                {isDeploying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
                Publish
              </Button>
            </div>
          </div>
          
          {/* Main Studio Body (Split Left & Right) */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ── LEFT PANE: Modular ChatPanel (History, Reasoning, Suggestions, Follow-up) ── */}
            <ChatPanel
              tenantSlug={tenantSlug}
              messages={displayMessages}
              isLoading={loading}
              loadingStep={loadingStep}
              iterationPrompt={iterationPrompt}
              onIterationPromptChange={setIterationPrompt}
              onIterate={handleIterate}
              creditsRemaining={creditsRemaining}
              isUnlimited={isUnlimited}
              models={AI_MODEL_REGISTRY}
              selectedModelId={selectedModel}
              onSelectModel={setSelectedModel}
              hasUpgradedPlan={hasUpgradedPlan}
              versionHistory={versionHistory}
              activeVersionNumber={activeVersionNumber}
              onSelectVersion={(ver) => {
                setActiveVersionNumber(ver)
                const found = versionHistory.find((v) => v.version === ver)
                if (found?.previewUrl) setPreviewUrl(found.previewUrl)
              }}
              isReasoningOpen={isReasoningOpen}
              onToggleReasoning={() => setIsReasoningOpen(!isReasoningOpen)}
              quickSuggestions={QUICK_ITERATION_SUGGESTIONS}
            />

            {/* ── RIGHT PANE: Multi-Tab Viewer (Preview | Code | Console) ── */}
            <div className="flex-1 bg-muted/10 flex flex-col overflow-hidden">
              {activeViewerTab === "preview" && (
                <PreviewPanel
                  previewUrl={previewUrl}
                  generatedFiles={generatedFiles}
                  isSandpackPreview={true}
                />
              )}
              {activeViewerTab === "code" && (
                <CodeViewer files={generatedFiles} />
              )}
              {activeViewerTab === "console" && (
                <ConsoleViewer logs={consoleLogs} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── v0.app-STYLE EMPTY STATE: "What do you want to create?" ── */
        <div className={`flex flex-1 flex-col items-center justify-center transition-all ${
          isFullscreen
            ? "fixed inset-0 z-50 w-screen h-screen bg-background p-4 md:p-6 overflow-auto"
            : "min-h-[520px] py-10"
        }`}>
          <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
            {showMcpHint && (
              <div className="relative rounded-2xl border border-border/70 bg-muted/30 p-4 text-left">
                <button
                  type="button"
                  onClick={() => setShowMcpHint(false)}
                  className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div className="space-y-1.5 pr-5">
                    <p className="text-xs font-bold text-foreground">Ingin pakai AI Agent Anda sendiri?</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Schema CMS tenant ini sudah bisa dibaca lewat MCP oleh AI agent eksternal (Claude Code, Cursor, dll.) untuk membangun frontend dengan tool pilihan Anda.
                    </p>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/${tenantSlug}/developer/mcp`)}
                      className="text-[11px] font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      Ambil token koneksi MCP <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center">
              Website apa yang ingin Anda buat?
            </h2>

            {/* ── Prompt Composer Card ── */}
            <div className="rounded-2xl bg-card border border-border/80 shadow-md overflow-visible">
              <Textarea
                placeholder="Minta SaCMS AI membangun website..."
                className="resize-none min-h-[96px] text-sm rounded-2xl rounded-b-none border-0 shadow-none bg-transparent p-4 focus-visible:ring-0"
                value={mainPrompt}
                onChange={e => setMainPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleGenerateWebsite()
                  }
                }}
              />

              {/* Toolbar row */}
              <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
                <div className="flex items-center gap-1.5 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted"
                    title="Lampirkan (segera hadir)"
                    disabled
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  {/* Multi-Provider Model Picker */}
                  <ModelPicker
                    models={AI_MODEL_REGISTRY}
                    selectedModelId={selectedModel}
                    onSelectModel={setSelectedModel}
                    hasUpgradedPlan={hasUpgradedPlan}
                    compact={false}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    onClick={() => handleGenerateWebsite()}
                    disabled={loading || !mainPrompt.trim() || (!isUnlimited && creditsRemaining < currentModelConfig.credits)}
                    className="h-8 w-8 rounded-full bg-foreground text-background hover:bg-foreground/90 shadow-none disabled:opacity-40"
                    title={`Bangun Website via SaCMS MCP (-${currentModelConfig.credits} Credits)`}
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Credits usage bar */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-muted/50 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-amber-500 fill-amber-500" />
                {isUnlimited ? "Saldo AI: Unlimited" : `Anda memiliki ${creditsRemaining} Credits tersisa`}
              </span>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Beli credits
              </button>
            </div>

            {/* Quick Inspiration Chips */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Ide Cepat
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
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
          </div>
        </div>
      )}



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
              {deploymentInfo?.simulated || deploymentInfo?.hostType === "simulation"
                ? "Deploy Simulasi Selesai"
                : "Deploy ke Cloud Berhasil!"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {deploymentInfo?.simulated || deploymentInfo?.hostType === "simulation"
                ? "Ini adalah pratinjau alur deploy — belum ada infrastruktur produksi nyata yang dikonfigurasi."
                : "Aplikasi Next.js Anda kini telah aktif di jaringan cloud edge berkecepatan tinggi."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(deploymentInfo?.simulated || deploymentInfo?.hostType === "simulation") && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Tidak ada deploy nyata yang terjadi.</p>
                  <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                    {deploymentInfo?.hostType === "vps"
                      ? "Belum ada server VPS dedicated yang terhubung ke workspace ini. URL di bawah bersifat placeholder dan tidak akan bisa diakses."
                      : "Integrasi Vercel belum dikonfigurasi oleh administrator platform. URL di bawah bersifat placeholder dan tidak akan bisa diakses."}
                  </p>
                </div>
              </div>
            )}
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

      {/* ── CUSTOM DOMAIN MODAL ── */}
      <Dialog open={isDomainModalOpen} onOpenChange={(open) => {
        setIsDomainModalOpen(open)
        if (!open) { setCustomDomainResult(null); setCustomDomainInput("") }
      }}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-foreground flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Hubungkan Domain Kustom
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Arahkan domain Anda sendiri (mis. <code className="text-[11px]">situs.perusahaan.com</code>) ke website ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {!customDomainResult ? (
              <div className="space-y-2">
                <Label htmlFor="custom-domain-input" className="text-xs font-bold text-foreground">
                  Nama Domain
                </Label>
                <Input
                  id="custom-domain-input"
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  placeholder="situs.perusahaan.com"
                  className="h-9 text-xs rounded-xl"
                  disabled={isVerifyingDomain}
                  onKeyDown={(e) => e.key === "Enter" && handleConfigureDomain()}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {(customDomainResult.domain?.simulated || customDomainResult.dns?.simulated) && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Ini adalah contoh, bukan konfigurasi nyata.</p>
                      <p className="mt-0.5 text-amber-700/80 dark:text-amber-400/80">
                        Integrasi Vercel belum dikonfigurasi platform ini — hubungi administrator SaCMS.
                      </p>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Domain</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-bold",
                        customDomainResult.domain?.verified
                          ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                          : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                      )}
                    >
                      {customDomainResult.domain?.verified ? "Terverifikasi" : "Menunggu DNS"}
                    </Badge>
                  </div>
                  <p className="text-xs font-mono font-bold text-foreground">{customDomainResult.domain?.name}</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Atur DNS Record berikut di penyedia domain Anda:
                  </span>
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/60">
                      <span className="text-muted-foreground">CNAME</span>
                      <span className="text-foreground font-bold truncate">{customDomainResult.dns?.cname || "cname.vercel-dns.com"}</span>
                    </div>
                    {customDomainResult.dns?.aRecord && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/60">
                        <span className="text-muted-foreground">A</span>
                        <span className="text-foreground font-bold truncate">{customDomainResult.dns.aRecord}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {!customDomainResult ? (
              <>
                <Button
                  variant="ghost"
                  className="rounded-xl text-xs"
                  onClick={() => setIsDomainModalOpen(false)}
                  disabled={isVerifyingDomain}
                >
                  Batal
                </Button>
                <Button
                  onClick={handleConfigureDomain}
                  disabled={isVerifyingDomain || !customDomainInput.trim()}
                  className="rounded-xl text-xs font-bold"
                >
                  {isVerifyingDomain ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Memverifikasi...
                    </>
                  ) : (
                    "Hubungkan Domain"
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsDomainModalOpen(false)} className="rounded-xl text-xs font-bold">
                Tutup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── IMPORT SCHEMA CONFIRM MODAL ── */}
      <Dialog open={!!pendingImportSchema} onOpenChange={(open) => {
        if (!open && !isImportingSchema) { setPendingImportSchema(null); setPendingImportFileName("") }
      }}>
        <DialogContent className="rounded-2xl border border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" /> Impor Skema dari JSON
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Struktur baru dari <strong className="text-foreground font-mono">{pendingImportFileName}</strong> akan ditambahkan ke workspace ini. Struktur dengan slug yang sudah ada akan dilewati — impor tidak menimpa data yang sudah ada.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Content Types</span>
              <span className="font-bold text-foreground">{pendingImportSchema?.contentTypes?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Single Types</span>
              <span className="font-bold text-foreground">{pendingImportSchema?.singleTypes?.length || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Komponen</span>
              <span className="font-bold text-foreground">{pendingImportSchema?.components?.length || 0}</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              className="rounded-xl text-xs"
              onClick={() => { setPendingImportSchema(null); setPendingImportFileName("") }}
              disabled={isImportingSchema}
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmImportSchema}
              disabled={isImportingSchema}
              className="rounded-xl text-xs font-bold"
            >
              {isImportingSchema ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Mengimpor...
                </>
              ) : (
                "Impor Skema"
              )}
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
              Deploy website Anda dengan uptime 99.9% dan SSL otomatis.
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
