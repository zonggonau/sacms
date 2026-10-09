"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Zap,
  Sparkles,
  Send,
  Loader2,
  Play,
  RotateCcw,
  Copy,
  Check,
  Globe,
  ExternalLink,
  Code2,
  Eye,
  FileCode,
  Laptop,
  Tablet,
  Smartphone,
  RefreshCw,
  Save,
  Clock,
  History,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Bot,
  User,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  Plug,
  Database,
} from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { ROOT_DOMAIN } from "@/lib/portal-urls"
import { SCHEMA_MODEL_OPTIONS } from "../aischema/schema-step"
import { cn } from "@/lib/utils"

interface StaticSite {
  id: string
  prompt: string | null
  published: boolean
  html: string
  js: string
  draftHtml: string | null
  draftJs: string | null
  draftPrompt: string | null
  draftAt: string | null
  updatedAt: string
  stage: "mock" | "schema_applied" | "api_connected"
}

interface SiteVersion {
  id: string
  prompt: string | null
  publishedAt: string
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  text: string
  timestamp: string
  isDraftUpdate?: boolean
  offerSchemaStep?: boolean
  offerApiConnectStep?: boolean
}

const QUICK_PROMPTS = [
  {
    title: "E-Commerce & Keranjang",
    prompt: "Buat SPA e-commerce modern dengan katalog produk SaCMS, filter kategori, badge diskon, modal detail barang, dan keranjang belanja interaktif dengan tombol checkout WhatsApp.",
  },
  {
    title: "Company Profile & Layanan",
    prompt: "Buat website SPA company profile elegan dengan navigasi tabs (Beranda, Tentang Kami, Layanan, Tim, Kontak), hero banner modern, testimoni client, dan form pesan interaktif.",
  },
  {
    title: "Portal Berita & Artikel",
    prompt: "Buat SPA portal berita online dengan headline slider, kategori berita, pencarian instan, modal baca artikel lengkap, dan tombol share sosmed.",
  },
  {
    title: "Katalog Properti / Mobil",
    prompt: "Buat SPA showcase listing properti/kendaraan dengan filter harga, spesifikasi fitur (kamar, luas/mesin), galeri foto modal, dan formulir booking survey.",
  },
]

export function AiWebsiteBuilderClient({ tenantSlug }: { tenantSlug: string }) {
  const { toast } = useToast()

  // Main site & version state
  const [site, setSite] = useState<StaticSite | null>(null)
  const [versions, setVersions] = useState<SiteVersion[]>([])
  const [loading, setLoading] = useState(true)

  // Navigation tabs
  const [leftTab, setLeftTab] = useState<"chat" | "history" | "mcp">("chat")
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview")
  const [activeCodeFile, setActiveCodeFile] = useState<"index.html" | "app.js">("index.html")

  // MCP Schema Inspection & Auto-Provision state
  const [mcpData, setMcpData] = useState<{
    mcpStatus: string
    tenantSlug: string
    apiBase: string
    totalCollections: number
    totalSingletons: number
    contentTypes: Array<{
      id: string
      name: string
      slug: string
      description?: string
      fieldsCount: number
      totalEntries: number
      hasEntries: boolean
      endpoint: string
      relativeEndpoint: string
    }>
    singleTypes: Array<{
      id: string
      name: string
      slug: string
      description?: string
      fieldsCount: number
      hasData: boolean
      endpoint: string
      relativeEndpoint: string
    }>
  } | null>(null)
  const [isLoadingMcp, setIsLoadingMcp] = useState(false)
  const [newSchemaPrompt, setNewSchemaPrompt] = useState("")
  const [isProvisioningSchema, setIsProvisioningSchema] = useState(false)

  // Device preview modes
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [previewKey, setPreviewKey] = useState(0)

  // AI Generation & Chat state
  const [prompt, setPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState<string>(SCHEMA_MODEL_OPTIONS[0].value)
  const [isGenerating, setIsGenerating] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // Code editor state
  const [editorHtml, setEditorHtml] = useState("")
  const [editorJs, setEditorJs] = useState("")
  const [isSavingCode, setIsSavingCode] = useState(false)
  const [copiedFile, setCopiedFile] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isTogglingPublish, setIsTogglingPublish] = useState(false)
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false)
  const [isConnectingApi, setIsConnectingApi] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  const siteUrl = `https://${tenantSlug}.${ROOT_DOMAIN}`

  // Fetch MCP status & live schema
  const fetchMcpInfo = async () => {
    setIsLoadingMcp(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/mcp-seed`)
      if (res.ok) {
        const data = await res.json()
        setMcpData(data)
      }
    } catch (err) {
      console.warn("Failed fetching MCP info:", err)
    } finally {
      setIsLoadingMcp(false)
    }
  }

  // Provision new schema via MCP prompt
  const handleProvisionSchema = async () => {
    if (!newSchemaPrompt.trim()) return
    setIsProvisioningSchema(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/mcp-seed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: newSchemaPrompt.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Gagal membangun skema via MCP")
      toast({
        title: "Skema & Data MCP Dibuat!",
        description: "Content types dan data terbit baru berhasil dibangun di database.",
      })
      setNewSchemaPrompt("")
      await fetchMcpInfo()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Provisi Skema", description: err.message })
    } finally {
      setIsProvisioningSchema(false)
    }
  }

  // Fetch site data
  const fetchData = async () => {
    try {
      const [siteRes, versionsRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/static-site`),
        fetch(`/api/tenant/${tenantSlug}/static-site/versions`),
      ])

      const siteData = await siteRes.json()
      const versionsData = await versionsRes.json()

      const s = siteData.site as StaticSite | null
      setSite(s)
      setVersions(versionsData.versions || [])

      if (s) {
        const curHtml = s.draftHtml || s.html || ""
        const curJs = s.draftJs || s.js || ""
        setEditorHtml(curHtml)
        setEditorJs(curJs)

        // Seed initial chat history if available
        if (s.draftPrompt || s.prompt) {
          setMessages([
            {
              id: "init-prompt",
              role: "user",
              text: s.draftPrompt || s.prompt || "Inisialisasi Website SPA",
              timestamp: new Date(s.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            {
              id: "init-reply",
              role: "assistant",
              text: "SPA Vue.js 3 telah berhasil dibangun. Anda dapat melihat pratinjau live di sisi kanan atau memeriksa index.html & app.js di tab Code.",
              timestamp: new Date(s.updatedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isDraftUpdate: true,
              offerSchemaStep: s.stage === "mock",
              offerApiConnectStep: s.stage === "schema_applied",
            },
          ])
        }
      }
    } catch (err: any) {
      console.error("Error fetching site data:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    fetchMcpInfo()
  }, [tenantSlug])

  // Scroll to bottom of chat
  useEffect(() => {
    if (leftTab === "chat") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, leftTab])

  // Handle AI Generate / Refine
  const handleGenerate = async (customPrompt?: string) => {
    const textToSubmit = (customPrompt || prompt).trim()
    if (!textToSubmit) {
      toast({ variant: "destructive", title: "Prompt kosong", description: "Tuliskan instruksi atau deskripsi website yang ingin dibuat." })
      return
    }

    const userMsgId = "msg-" + Date.now()
    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        role: "user",
        text: textToSubmit,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]
    setMessages(newMessages)
    setPrompt("")
    setIsGenerating(true)

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToSubmit, model: selectedModel }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Gagal membuat website")
      }

      const updatedSite = data.site as StaticSite
      setSite(updatedSite)
      setEditorHtml(updatedSite.draftHtml || updatedSite.html || "")
      setEditorJs(updatedSite.draftJs || updatedSite.js || "")
      setPreviewKey((k) => k + 1)
      setRightTab("preview")
      fetchMcpInfo()

      setMessages((prev) => [
        ...prev,
        {
          id: "bot-" + Date.now(),
          role: "assistant",
          text: "✨ Tampilan SPA Vue.js 3 berhasil dibuat dengan data contoh (mock) — belum tersambung ke CMS asli. Lihat hasilnya di panel Preview.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isDraftUpdate: true,
          offerSchemaStep: true,
        },
      ])

      toast({
        title: "Draft Berhasil Dibuat",
        description: "Draft SPA Vue.js 3 (data mock) siap diuji di panel Preview.",
      })
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot-err-" + Date.now(),
          role: "assistant",
          text: `⚠️ Maaf, proses gagal: ${err.message}. Silakan coba ulangi prompt Anda.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      toast({ variant: "destructive", title: "Generasi Gagal", description: err.message })
    } finally {
      setIsGenerating(false)
    }
  }

  // Step 2 (opsional): buatkan skema CMS yang cocok dengan data mock di draft saat ini
  const handleGenerateSchema = async () => {
    setIsGeneratingSchema(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/generate-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal membuat skema")

      setSite(data.site as StaticSite)
      fetchMcpInfo()

      setMessages((prev) => [
        ...prev,
        {
          id: "bot-schema-" + Date.now(),
          role: "assistant",
          text: "📦 Skema CMS berhasil dibuat & diisi data yang cocok dengan tampilan. Cek di tab MCP & API. Lanjut hubungkan tampilan ke data asli ini?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          offerApiConnectStep: true,
        },
      ])
      toast({ title: "Skema CMS Dibuat", description: "Content Type/Single Type baru sudah terisi data sesuai tampilan." })
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot-schema-err-" + Date.now(),
          role: "assistant",
          text: `⚠️ Gagal membuat skema: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      toast({ variant: "destructive", title: "Gagal Membuat Skema", description: err.message })
    } finally {
      setIsGeneratingSchema(false)
    }
  }

  // Step 3 (opsional, setelah Step 2): sambungkan app.js ke data CMS asli, gantikan mock
  const handleConnectApi = async () => {
    setIsConnectingApi(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/connect-api`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || data?.error || "Gagal menghubungkan ke API")

      const updatedSite = data.site as StaticSite
      setSite(updatedSite)
      setEditorJs(updatedSite.draftJs || updatedSite.js || "")
      setPreviewKey((k) => k + 1)

      setMessages((prev) => [
        ...prev,
        {
          id: "bot-api-" + Date.now(),
          role: "assistant",
          text: "🔌 Tampilan sudah tersambung ke data CMS asli — tidak lagi memakai data mock. Publish kalau sudah siap tampil ke publik.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      toast({ title: "Terhubung ke API Asli", description: "app.js sekarang mengambil data langsung dari CMS." })
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: "bot-api-err-" + Date.now(),
          role: "assistant",
          text: `⚠️ Gagal menghubungkan ke API: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      toast({ variant: "destructive", title: "Gagal Menghubungkan API", description: err.message })
    } finally {
      setIsConnectingApi(false)
    }
  }

  // Handle Save Manual Code Changes
  const handleSaveCode = async () => {
    setIsSavingCode(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftHtml: editorHtml, draftJs: editorJs }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Gagal menyimpan perubahan kode")

      setSite(data.site)
      setPreviewKey((k) => k + 1)
      toast({ title: "Kode Tersimpan", description: "Perubahan manual index.html & app.js berhasil disimpan ke draft." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Simpan", description: err.message })
    } finally {
      setIsSavingCode(false)
    }
  }

  // Handle Publish Draft to Live
  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/publish`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Gagal mem-publish draft")

      setSite(data.site)
      // refresh versions
      const versRes = await fetch(`/api/tenant/${tenantSlug}/static-site/versions`)
      const versData = await versRes.json()
      setVersions(versData.versions || [])

      toast({
        title: "Website Live!",
        description: `SPA Vue.js 3 telah terbit di ${siteUrl}`,
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Publish Gagal", description: err.message })
    } finally {
      setIsPublishing(false)
    }
  }

  // Handle Toggle Published / Offline
  const handleTogglePublished = async () => {
    if (!site?.html) return
    setIsTogglingPublish(true)
    try {
      const newStatus = !site.published
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || "Gagal mengubah status publish")

      setSite(data.site)
      toast({
        title: newStatus ? "Website Aktif" : "Website Di-unpublish",
        description: newStatus ? `Live di ${siteUrl}` : "Website kini offline.",
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengubah Status", description: err.message })
    } finally {
      setIsTogglingPublish(false)
    }
  }

  // Handle Rollback
  const handleRollback = async (version: SiteVersion) => {
    setRollingBackId(version.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/versions/${version.id}/rollback`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal melakukan rollback")

      await fetchData()
      setPreviewKey((k) => k + 1)
      toast({ title: "Rollback Berhasil", description: "Website kembali ke versi yang dipilih." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Rollback Gagal", description: err.message })
    } finally {
      setRollingBackId(null)
    }
  }

  // Handle Copy Code
  const handleCopyCode = async (code: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedFile(fileName)
      setTimeout(() => setCopiedFile(null), 2000)
      toast({ title: "Kode Tersalin", description: `${fileName} disalin ke clipboard.` })
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin" })
    }
  }

  // Handle Delete Website
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const handleDeleteSite = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.message || data?.error || "Gagal menghapus website")
      }

      setSite(null)
      setVersions([])
      setEditorHtml("")
      setEditorJs("")
      setMessages([])
      setPreviewKey((k) => k + 1)

      toast({
        title: "Website Berhasil Dihapus",
        description: "Seluruh kode draft dan website SPA telah dibersihkan secara permanen.",
      })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal Menghapus Website",
        description: err.message,
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  // Handle Sync CMS Data via MCP
  const [isSeedingMcp, setIsSeedingMcp] = useState(false)
  const handleSyncMcp = async () => {
    setIsSeedingMcp(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/mcp-seed`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.message || "Gagal sinkronisasi data MCP")
      }

      toast({
        title: "MCP Terhubung & Sinkron",
        description: "Skema dan sampel data terbit berhasil disinkronkan ke CMS via MCP Server.",
      })
      setPreviewKey((k) => k + 1)
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Gagal Sinkronisasi MCP",
        description: err.message,
      })
    } finally {
      setIsSeedingMcp(false)
    }
  }

  // Build reactive live preview document with Vue 3 and app.js injection
  const previewSrcDoc = useMemo(() => {
    const rawHtml = site?.draftHtml || site?.html || editorHtml || ""
    let rawJs = site?.draftJs || site?.js || editorJs || ""
    if (!rawHtml) return ""

    // Normalize any legacy code attempting to resolve origin in an iframe
    rawJs = rawJs
      .replace(/window\.location\.origin\s*\+\s*['"]\/api\/public/g, "'' + '/api/public")
      .replace(/origin\s*\+\s*['"]\/api\/public/g, "'' + '/api/public")
      .replace(/['"]null\/api\/public/g, "'/api/public")

    // Injected environment helper and fetch normalizer
    const envScript = `<script>
      window.__SACMS_TENANT_SLUG__ = "${tenantSlug}";
      window.__SACMS_API_BASE__ = "/api/public/${tenantSlug}";
      (function() {
        const _origFetch = window.fetch;
        window.fetch = function(resource, init) {
          if (typeof resource === 'string' && resource.includes('/api/public/')) {
            const idx = resource.indexOf('/api/public/');
            resource = resource.slice(idx);
          }
          return _origFetch.call(this, resource, init);
        };
      })();
    </script>`

    // Inlined script tag executing app.js directly within the preview frame
    const scriptTag = `<script>\ntry {\n${rawJs}\n} catch(err) { console.error('Vue SPA Error:', err); }\n<\/script>`

    let finalDoc = rawHtml
    if (finalDoc.includes("<head>")) {
      finalDoc = finalDoc.replace("<head>", `<head>\n<base href="/" />\n${envScript}`)
    } else {
      finalDoc = `<base href="/" />\n${envScript}\n${finalDoc}`
    }

    if (finalDoc.includes('<script src="app.js"></script>')) {
      finalDoc = finalDoc.replace('<script src="app.js"></script>', scriptTag)
    } else if (finalDoc.includes("<script src='app.js'></script>")) {
      finalDoc = finalDoc.replace("<script src='app.js'></script>", scriptTag)
    } else if (finalDoc.includes("</body>")) {
      finalDoc = finalDoc.replace("</body>", `${scriptTag}\n</body>`)
    } else {
      finalDoc = `${finalDoc}\n${scriptTag}`
    }
    return finalDoc
  }, [site?.draftHtml, site?.html, site?.draftJs, site?.js, editorHtml, editorJs, tenantSlug])

  const hasDraftPending = Boolean(site?.draftAt)
  const isCodeModified =
    editorHtml !== (site?.draftHtml || site?.html || "") ||
    editorJs !== (site?.draftJs || site?.js || "")

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background text-foreground overflow-hidden">
      {/* Top Header Control Bar */}
      <div className="border-b border-border/80 bg-card/60 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-tight text-foreground truncate">
                AI Instant Website Builder
              </span>
              <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shrink-0">
                Vue.js 3 SPA
              </Badge>
              <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 shrink-0 hidden sm:flex items-center gap-1" title="SaCMS MCP Server Bridge Connected">
                <Plug className="h-3 w-3" /> MCP Connected
              </Badge>
              {site?.draftAt && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold rounded-full shrink-0 flex items-center gap-1",
                    site.stage === "api_connected"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : site.stage === "schema_applied"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                      : "bg-muted text-muted-foreground border-border/80"
                  )}
                  title="Status tahap pipeline: Tampilan (data mock) -> Skema CMS -> API Asli"
                >
                  {site.stage === "api_connected" ? "API Live" : site.stage === "schema_applied" ? "Skema Terhubung" : "Data Mock"}
                </Badge>
              )}
              {site?.published && (
                <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Live
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="truncate">{siteUrl}</span>
              <a href={siteUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href={`/dashboard/${tenantSlug}/infrastructure?tab=static-site`}
                className="text-[10px] text-muted-foreground/70 hover:text-primary hover:underline shrink-0"
                title="Website yang sama juga bisa dikelola lewat tab Infrastructure > Website Gratis — keduanya mengedit draft yang sama"
              >
                (website yang sama dengan Infrastructure &gt; Website Gratis)
              </a>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Tombol Sinkronisasi Data CMS via MCP */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncMcp}
            disabled={isSeedingMcp}
            className="h-8 px-2.5 rounded-xl font-bold text-xs border-border/80 text-muted-foreground hover:text-foreground gap-1.5"
            title="Sinkronkan data sampel CMS melalui MCP Server ke database workspace"
          >
            {isSeedingMcp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5 text-violet-500" />}
            <span className="hidden sm:inline">Sync MCP Data</span>
          </Button>

          {hasDraftPending && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing}
              className="h-8 px-3 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-1.5"
            >
              {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              Publish Live
            </Button>
          )}

          {site?.html && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePublished}
              disabled={isTogglingPublish}
              className="h-8 px-3 rounded-xl font-bold text-xs border-border/80"
            >
              {isTogglingPublish ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : site.published ? "Unpublish" : "Go Live"}
            </Button>
          )}

          {/* Tombol Hapus Website (Icon Delete dengan AlertDialog) */}
          {Boolean(site?.html || site?.draftHtml) && (
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isDeleting}
                  className="h-8 w-8 p-0 rounded-xl font-bold text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 border-rose-500/20 hover:border-rose-500/40 cursor-pointer"
                  title="Hapus website SPA permanen"
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Hapus Website SPA Ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tindakan ini akan menghapus website live, seluruh kode draft (index.html & app.js), dan seluruh riwayat versinya secara permanen. Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteSite}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                  >
                    Hapus Permanen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Main Studio Body: Two Panels */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        
        {/* ================= LEFT SIDEBAR: Chat & History ================= */}
        <div className="w-80 md:w-96 border-r border-border/80 bg-card/30 flex flex-col shrink-0">
          
          {/* Left Panel Tabs */}
          <div className="border-b border-border/60 p-2 flex items-center gap-1 bg-muted/20">
            <button
              onClick={() => setLeftTab("chat")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                leftTab === "chat"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Prompt & Chat</span>
            </button>
            <button
              onClick={() => setLeftTab("history")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                leftTab === "history"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <History className="h-3.5 w-3.5" />
              <span>Riwayat</span>
              {versions.length > 0 && (
                <span className="text-[10px] bg-muted px-1.5 rounded-full font-bold">{versions.length}</span>
              )}
            </button>
            <button
              onClick={() => {
                setLeftTab("mcp")
                fetchMcpInfo()
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                leftTab === "mcp"
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Plug className="h-3.5 w-3.5 text-violet-500" />
              <span>MCP & API</span>
              {mcpData && (
                <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 rounded-full font-bold">
                  {(mcpData.totalCollections || 0) + (mcpData.totalSingletons || 0)}
                </span>
              )}
            </button>
          </div>

          {/* TAB 1: Chat & Prompt */}
          {leftTab === "chat" ? (
            <div className="flex flex-col flex-1 min-h-0">
              
              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {messages.length === 0 ? (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
                      <Sparkles className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Bangun SPA Vue.js Instan</h3>
                      <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto leading-relaxed">
                        Tulis prompt Anda di bawah atau pilih template untuk menghasilkan website SPA lengkap (index.html + app.js).
                      </p>
                    </div>

                    {/* Quick Inspirations */}
                    <div className="pt-2 space-y-2 text-left">
                      <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1">
                        Inspirasi Cepat
                      </p>
                      {QUICK_PROMPTS.map((qp, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleGenerate(qp.prompt)}
                          disabled={isGenerating}
                          className="w-full text-left p-2.5 rounded-xl border border-border/60 bg-background hover:border-primary/50 hover:bg-muted/40 transition-all group cursor-pointer"
                        >
                          <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                            <span>{qp.title}</span>
                            <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                            {qp.prompt}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-2.5 max-w-[92%]",
                        msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                      )}
                    >
                      <div
                        className={cn(
                          "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        )}
                      >
                        {msg.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl p-3 text-xs leading-relaxed space-y-1",
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-xs"
                            : "bg-muted/60 border border-border/60 text-foreground rounded-tl-xs"
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        {msg.offerSchemaStep && site?.stage === "mock" && (
                          <Button
                            size="sm"
                            onClick={handleGenerateSchema}
                            disabled={isGeneratingSchema}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold w-full justify-start"
                          >
                            {isGeneratingSchema ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Database className="h-3 w-3 mr-1.5" />}
                            Buatkan Skema Sesuai Tampilan Ini
                            <span className="ml-auto opacity-70 font-normal">5 kredit</span>
                          </Button>
                        )}
                        {msg.offerApiConnectStep && site?.stage === "schema_applied" && (
                          <Button
                            size="sm"
                            onClick={handleConnectApi}
                            disabled={isConnectingApi}
                            className="h-7 px-2.5 rounded-lg text-[11px] font-bold w-full justify-start"
                          >
                            {isConnectingApi ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Plug className="h-3 w-3 mr-1.5" />}
                            Hubungkan ke API Asli
                            <span className="ml-auto opacity-70 font-normal">3 kredit</span>
                          </Button>
                        )}
                        <div
                          className={cn(
                            "text-[9px] text-right font-mono opacity-60",
                            msg.role === "user" ? "text-primary-foreground" : "text-muted-foreground"
                          )}
                        >
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isGenerating && (
                  <div className="flex gap-2.5 mr-auto max-w-[85%]">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-xs p-3 text-xs bg-muted/60 border border-border/60 text-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      <span>Merancang Vue.js SPA (index.html &amp; app.js)...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input & Model Bar */}
              <div className="p-3 border-t border-border/70 bg-card/40 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="h-7 text-[11px] rounded-lg border-border/60 bg-background font-semibold w-full">
                      <SelectValue placeholder="Pilih AI Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEMA_MODEL_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">
                          {m.label} <span className="text-[10px] text-muted-foreground">({m.hint})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative">
                  <Textarea
                    placeholder="Instruksikan AI (cth: Ubah warna tombol jadi biru, tambahkan tab kontak)..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault()
                        handleGenerate()
                      }
                    }}
                    rows={3}
                    className="pr-10 resize-none text-xs rounded-xl bg-background border-border/80 focus-visible:ring-primary/30"
                  />
                  <Button
                    size="icon"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || !prompt.trim()}
                    className="absolute right-2 bottom-2 h-7 w-7 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer"
                  >
                    {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                  <span>Tekan <kbd className="font-mono bg-muted px-1 py-0.5 rounded">Ctrl+Enter</kbd> untuk kirim</span>
                  <span
                    className="flex items-center gap-1"
                    title="5 kredit untuk membuat/memperbarui tampilan (data mock). Buatkan Skema dan Hubungkan API adalah langkah terpisah dengan biayanya masing-masing."
                  >
                    <Sparkles className="h-2.5 w-2.5" /> Biaya: 5 kredit
                  </span>
                </div>
              </div>

            </div>
          ) : leftTab === "history" ? (
            /* TAB 2: Version History */
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {versions.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <Clock className="h-8 w-8 mx-auto opacity-40" />
                  <p>Belum ada riwayat versi.</p>
                  <p className="text-[11px]">Riwayat otomatis tersimpan setiap kali Anda mengklik tombol Publish Live.</p>
                </div>
              ) : (
                versions.map((ver, idx) => (
                  <div
                    key={ver.id}
                    className="p-3 rounded-xl border border-border/60 bg-background/60 hover:bg-muted/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-bold">
                        Versi #{versions.length - idx}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {new Date(ver.publishedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {ver.prompt && (
                      <p className="text-xs text-foreground line-clamp-2 italic">
                        "{ver.prompt}"
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(ver)}
                      disabled={rollingBackId === ver.id}
                      className="w-full h-7 rounded-lg text-xs font-bold gap-1.5"
                    >
                      {rollingBackId === ver.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      Rollback ke Versi Ini
                    </Button>
                  </div>
                ))
              )}
            </div>
          ) : (
            /* TAB 3: MCP & CMS Schema Explorer */
            <div className="flex-1 overflow-y-auto p-3 space-y-3.5 text-xs">
              {/* Status Header */}
              <div className="p-3 rounded-xl border border-border/70 bg-background/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Plug className="h-4 w-4 text-emerald-500" />
                    <span>SaCMS MCP Bridge</span>
                  </div>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    Connected
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Terhubung in-process ke skema &amp; database CMS workspace. AI Website Builder secara otomatis membaca skema &amp; data terbit.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                  <span className="text-muted-foreground">Base Public REST:</span>
                  <code className="font-mono text-primary font-bold">/api/public/{tenantSlug}</code>
                </div>
              </div>

              {/* Quick Auto-Provision Form */}
              <div className="p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Bangun Skema Baru via MCP</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Ingin konsep bisnis baru? Ketik jenis bisnis Anda, AI MCP akan otomatis membuat Content Types &amp; data terbit.
                </p>
                <div className="space-y-1.5">
                  <Input
                    placeholder="Contoh: Rental Mobil Jayapura, Toko Distro, Klinik..."
                    value={newSchemaPrompt}
                    onChange={(e) => setNewSchemaPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleProvisionSchema()
                    }}
                    className="h-8 text-xs bg-background"
                  />
                  <Button
                    size="sm"
                    onClick={handleProvisionSchema}
                    disabled={isProvisioningSchema || !newSchemaPrompt.trim()}
                    className="w-full h-7 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white gap-1.5 cursor-pointer"
                  >
                    {isProvisioningSchema ? <Loader2 className="h-3 w-3 animate-spin" /> : <Database className="h-3 w-3" />}
                    Bangun Skema &amp; Data Otomatis
                  </Button>
                </div>
              </div>

              {/* Collections List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-blue-500" />
                    Koleksi Konten ({mcpData?.totalCollections ?? 0})
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchMcpInfo}
                    disabled={isLoadingMcp}
                    className="h-6 px-1.5 text-[10px] gap-1 cursor-pointer"
                  >
                    <RefreshCw className={cn("h-3 w-3", isLoadingMcp && "animate-spin")} />
                    Refresh
                  </Button>
                </div>

                {isLoadingMcp && !mcpData ? (
                  <div className="py-6 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" />
                    <span className="text-[11px]">Memuat skema MCP...</span>
                  </div>
                ) : !mcpData?.contentTypes || mcpData.contentTypes.length === 0 ? (
                  <div className="p-3 text-center border border-dashed rounded-xl text-muted-foreground text-[11px]">
                    Belum ada Content Types. Gunakan form di atas untuk membuat otomatis via MCP.
                  </div>
                ) : (
                  mcpData.contentTypes.map((ct) => (
                    <div
                      key={ct.id}
                      className="p-2.5 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{ct.name}</span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium">
                            {ct.fieldsCount} Fields
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] px-1.5 py-0 font-medium",
                              ct.totalEntries > 0
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                                : "text-amber-600 border-amber-500/30"
                            )}
                          >
                            {ct.totalEntries} Terbit
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono bg-muted/40 px-2 py-1 rounded-md">
                        <span className="truncate">{ct.relativeEndpoint}</span>
                        <button
                          onClick={() => handleCopyCode(ct.endpoint, ct.slug)}
                          className="hover:text-foreground shrink-0 ml-1 cursor-pointer"
                          title="Salin URL endpoint"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Single Types List */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-amber-500" />
                  Singleton Profil ({mcpData?.totalSingletons ?? 0})
                </div>

                {!mcpData?.singleTypes || mcpData.singleTypes.length === 0 ? (
                  <div className="p-3 text-center border border-dashed rounded-xl text-muted-foreground text-[11px]">
                    Belum ada Single Types.
                  </div>
                ) : (
                  mcpData.singleTypes.map((st) => (
                    <div
                      key={st.id}
                      className="p-2.5 rounded-xl border border-border/60 bg-card/60 hover:bg-muted/30 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{st.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] px-1.5 py-0 font-medium",
                            st.hasData
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "text-muted-foreground"
                          )}
                        >
                          {st.hasData ? "Published &amp; Ready" : "Belum Ada Data"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono bg-muted/40 px-2 py-1 rounded-md">
                        <span className="truncate">{st.relativeEndpoint}</span>
                        <button
                          onClick={() => handleCopyCode(st.endpoint, st.slug)}
                          className="hover:text-foreground shrink-0 ml-1 cursor-pointer"
                          title="Salin URL endpoint"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* ================= RIGHT PANEL: Preview & Code ================= */}
        <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
          
          {/* Right Header: Tab Switcher (Preview vs Code) + Controls */}
          <div className="border-b border-border/70 bg-card/30 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
            {/* View switcher */}
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setRightTab("preview")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  rightTab === "preview"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Eye className="h-3.5 w-3.5 text-emerald-500" />
                <span>Live Preview</span>
              </button>
              <button
                onClick={() => setRightTab("code")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  rightTab === "code"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Code2 className="h-3.5 w-3.5 text-primary" />
                <span>Source Code (2 Files)</span>
              </button>
            </div>

            {/* Controls depending on active tab */}
            {rightTab === "preview" ? (
              <div className="flex items-center gap-2">
                {/* Device viewport toggle */}
                <div className="hidden sm:flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60 text-xs">
                  <button
                    onClick={() => setDeviceMode("desktop")}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      deviceMode === "desktop" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Desktop (100%)"
                  >
                    <Laptop className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeviceMode("tablet")}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      deviceMode === "tablet" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Tablet (768px)"
                  >
                    <Tablet className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeviceMode("mobile")}
                    className={cn(
                      "p-1.5 rounded-md transition-all",
                      deviceMode === "mobile" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Mobile (375px)"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setPreviewKey((k) => k + 1)}
                  title="Reload Preview"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              /* Code File Switcher Controls */
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/60">
                  <button
                    onClick={() => setActiveCodeFile("index.html")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all",
                      activeCodeFile === "index.html"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <FileCode className="h-3.5 w-3.5 text-blue-500" />
                    index.html
                  </button>
                  <button
                    onClick={() => setActiveCodeFile("app.js")}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold transition-all",
                      activeCodeFile === "app.js"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Code2 className="h-3.5 w-3.5 text-emerald-500" />
                    app.js
                  </button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-bold rounded-lg gap-1"
                  onClick={() =>
                    handleCopyCode(
                      activeCodeFile === "index.html" ? editorHtml : editorJs,
                      activeCodeFile
                    )
                  }
                >
                  {copiedFile === activeCodeFile ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copiedFile === activeCodeFile ? "Tersalin!" : "Salin"}
                </Button>

                {isCodeModified && (
                  <Button
                    size="sm"
                    className="h-7 text-xs font-bold rounded-lg gap-1 bg-primary text-primary-foreground"
                    onClick={handleSaveCode}
                    disabled={isSavingCode}
                  >
                    {isSavingCode ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    Simpan Perubahan
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* TAB CONTENT: Preview */}
          {rightTab === "preview" ? (
            <div className="flex-1 min-h-0 bg-neutral-900/40 p-2 md:p-4 flex items-center justify-center overflow-hidden">
              {!previewSrcDoc ? (
                <div className="text-center p-8 space-y-3 max-w-sm">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                    <Laptop className="h-6 w-6" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">Belum Ada Website yang Dibangun</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ketik prompt pada panel kiri untuk menghasilkan Single Page Application (SPA) Vue.js 3 pertama Anda.
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "h-full w-full bg-white dark:bg-slate-950 transition-all overflow-hidden flex flex-col shadow-xl",
                    deviceMode === "desktop" && "rounded-xl border border-border/80",
                    deviceMode === "tablet" && "max-w-[768px] rounded-2xl border-4 border-slate-700 dark:border-slate-800",
                    deviceMode === "mobile" && "max-w-[375px] rounded-3xl border-8 border-slate-700 dark:border-slate-800"
                  )}
                >
                  <iframe
                    key={previewKey}
                    title="Vue.js SPA Preview"
                    srcDoc={previewSrcDoc}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
                    className="w-full h-full border-0 bg-white"
                  />
                </div>
              )}
            </div>
          ) : (
            /* TAB CONTENT: Code Editor */
            <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 text-neutral-100 overflow-hidden font-mono text-xs">
              <div className="px-4 py-2 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between text-[11px] text-neutral-400">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {activeCodeFile === "index.html" ? "HTML5 + Vue 3 Mount Template" : "Vue 3 SPA Logic (Composition API)"}
                </span>
                <span>
                  {activeCodeFile === "index.html"
                    ? `${editorHtml.length.toLocaleString()} karakter`
                    : `${editorJs.length.toLocaleString()} karakter`}
                </span>
              </div>

              <div className="flex-1 p-3 overflow-hidden flex">
                <Textarea
                  value={activeCodeFile === "index.html" ? editorHtml : editorJs}
                  onChange={(e) => {
                    if (activeCodeFile === "index.html") setEditorHtml(e.target.value)
                    else setEditorJs(e.target.value)
                  }}
                  spellCheck={false}
                  className="w-full h-full resize-none font-mono text-xs leading-relaxed bg-transparent border-0 text-neutral-200 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto"
                />
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}
