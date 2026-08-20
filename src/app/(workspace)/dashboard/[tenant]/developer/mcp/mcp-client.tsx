"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Copy, Check, Plug, Terminal, Bot, Globe, ExternalLink,
  Zap, Code2, Key, ChevronDown, ChevronRight, Info, Server,
  AlertTriangle, Sparkles, Database, Layers, Webhook, Box,
  Play, RefreshCw, FileCode, CheckCircle2, Shield
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface MCPDashboardClientProps {
  tenantSlug: string
  tenantId: string
  existingTokens: { id: string; name: string; type?: string; description: string | null; createdAt: string }[]
}

// ─── Config generators per platform ──────────────────────────────────────────

function generateConfig(platform: string, mcpUrl: string, token: string = "YOUR_API_TOKEN"): string {
  switch (platform) {
    case "claude":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "cursor":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "windsurf":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            serverUrl: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "vscode":
      return JSON.stringify({
        servers: {
          sacms: {
            type: "http",
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "cline":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "antigravity":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      }, null, 2)

    case "v0":
      return mcpUrl

    case "inspector":
      return `npx @modelcontextprotocol/inspector "${mcpUrl}"`

    default:
      return mcpUrl
  }
}

// ─── Platform definitions ────────────────────────────────────────────────────

interface PlatformInfo {
  id: string
  name: string
  icon: string
  badge: string
  badgeColor: string
  configPath: string
  steps: string[]
  notes?: string[]
}

const PLATFORMS: PlatformInfo[] = [
  {
    id: "v0",
    name: "v0.dev",
    icon: "🔺",
    badge: "UI Generator & Builder",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    configPath: "v0.dev Project Settings → MCP",
    steps: [
      "Buka chat v0.dev atau menu Project Settings pada project Anda.",
      "Navigasi ke menu 'MCP Servers' atau 'Integrations'.",
      "Klik tombol '+ Add MCP Server' dan pilih koneksi HTTP / SSE.",
      "Masukkan Server URL dengan URL MCP SaCMS di bawah.",
      "Tambahkan Header: Key 'Authorization', Value 'Bearer <YOUR_API_TOKEN>'.",
      "Prompt contoh ke v0: 'Gunakan MCP SaCMS untuk membuat blog modern lengkap dengan Content Types articles, categories, dan ambil 5 data artikel pertama.'"
    ],
    notes: [
      "v0 dapat langsung membuat skema Content Type baru, mengisi data contoh, dan merender komponen React/Next.js interaktif."
    ]
  },
  {
    id: "antigravity",
    name: "Antigravity (AGY)",
    icon: "⚡",
    badge: "Google DeepMind Agent",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    configPath: ".agents/mcp_config.json",
    steps: [
      "Buka atau buat file .agents/mcp_config.json di root workspace project Anda.",
      "Salin dan tempelkan blok JSON konfigurasi di bawah.",
      "Ganti YOUR_API_TOKEN dengan token Full-Access workspace Anda.",
      "Antigravity akan otomatis mendeteksi server MCP 'sacms' saat proses tasking dimulai.",
      "Prompt contoh: 'Gunakan MCP sacms untuk query schema CMS dan buatkan Server Action untuk mutasi artikel.'"
    ]
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "🟦",
    badge: "AI Code Editor",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    configPath: "Cursor Settings → MCP",
    steps: [
      "Buka Cursor → Settings (Ctrl+Shift+J) → Features → MCP.",
      "Klik tombol '+ Add new MCP server'.",
      "Pilih Type: 'HTTP' / 'SSE'.",
      "Name: 'sacms', URL: Masukkan URL MCP SaCMS.",
      "Tambahkan Header: Authorization: Bearer <API_TOKEN>.",
      "Indikator hijau akan menyala tanda server aktif.",
      "Di Composer (Agent mode), minta: 'Gunakan MCP sacms untuk membuat content type products dan buatkan halaman etalase Next.js.'"
    ]
  },
  {
    id: "claude",
    name: "Claude Desktop",
    icon: "🟣",
    badge: "AI Assistant",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    configPath: "claude_desktop_config.json",
    steps: [
      "Buka Claude Desktop → Settings → Developer → Edit Config.",
      "Tambahkan blok server 'sacms' seperti yang disediakan di bawah.",
      "Simpan berkas konfigurasi lalu restart Claude Desktop.",
      "Ikon plug 🔌 akan muncul di kolom chat menandakan MCP terhubung.",
      "Prompt contoh: 'Daftarkan semua content type yang ada di workspace SaCMS saya dan buatkan ringkasannya.'"
    ],
    notes: [
      "Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
      "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
    ]
  },
  {
    id: "vscode",
    name: "VS Code (Copilot)",
    icon: "🐙",
    badge: "GitHub Copilot",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    configPath: ".vscode/mcp.json",
    steps: [
      "Buat file .vscode/mcp.json di root project Anda.",
      "Salin dan tempelkan konfigurasi JSON di bawah.",
      "Buka GitHub Copilot Chat dan beralih ke mode Agent.",
      "Tool MCP SaCMS akan otomatis terdaftar dan siap dipanggil."
    ]
  },
  {
    id: "windsurf",
    name: "Windsurf",
    icon: "🌊",
    badge: "AI IDE",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    configPath: "~/.codeium/windsurf/mcp_config.json",
    steps: [
      "Buka file ~/.codeium/windsurf/mcp_config.json.",
      "Masukkan konfigurasi server sacms.",
      "Restart Windsurf dan gunakan Cascade Agent."
    ]
  },
  {
    id: "cline",
    name: "Cline",
    icon: "🔵",
    badge: "VS Code Extension",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    configPath: "cline_mcp_settings.json",
    steps: [
      "Buka sidebar Cline → Settings → MCP Servers.",
      "Klik 'Configure MCP Servers' dan tempelkan konfigurasi JSON.",
      "Cline akan langsung memuat tool SaCMS secara live."
    ]
  },
]

// ─── Tool Group Definitions ──────────────────────────────────────────────────

interface ToolItem {
  name: string
  action: "READ" | "CREATE" | "UPDATE" | "DELETE" | "AUTOMATION"
  desc: string
  params: string
}

const TOOL_GROUPS: { groupName: string; icon: any; tools: ToolItem[] }[] = [
  {
    groupName: "1. Skema & Introspeksi (Schema Tools)",
    icon: Database,
    tools: [
      { name: "get_full_schema", action: "READ", desc: "Mengambil seluruh struktur arsitektur workspace (Content Types, Single Types, Components, dan relasi)", params: "none" },
      { name: "get_api_info", action: "READ", desc: "Panduan lengkap endpoint REST & GraphQL publik beserta contoh kode Next.js ISR", params: "baseUrl?" },
    ]
  },
  {
    groupName: "2. Tipe Konten & Data (Content Types & Entries CRUD)",
    icon: Layers,
    tools: [
      { name: "list_content_types", action: "READ", desc: "Daftar seluruh tipe konten koleksi beserta field dan total jumlah entri", params: "none" },
      { name: "get_content_type", action: "READ", desc: "Mendapatkan detail skema field suatu tipe konten berdasarkan slug/id", params: "slug" },
      { name: "create_content_type", action: "CREATE", desc: "Membuat skema koleksi baru beserta definisi field (string, richtext, number, relation, dll)", params: "name, slug, description?, fields[]" },
      { name: "update_content_type", action: "UPDATE", desc: "Memperbarui nama, deskripsi, atau mengubah set field tipe konten", params: "slug, name?, description?, fields[]" },
      { name: "delete_content_type", action: "DELETE", desc: "Menghapus permanen skema tipe konten beserta seluruh entri data di dalamnya", params: "slug" },
      { name: "query_content", action: "READ", desc: "Mengambil entri data konten (published/draft) dengan paginasi, pencarian, dan pengurutan", params: "contentTypeSlug, limit?, page?, status?, search?" },
      { name: "create_content_entry", action: "CREATE", desc: "Menyisipkan entri konten baru dengan payload JSON dinamis", params: "contentTypeSlug, data, status?" },
      { name: "update_content_entry", action: "UPDATE", desc: "Memperbarui isi data entri konten berdasarkan ID", params: "id, data?, status?" },
      { name: "delete_content_entry", action: "DELETE", desc: "Menghapus record entri data konten berdasarkan ID", params: "id" },
    ]
  },
  {
    groupName: "3. Halaman Tunggal (Single Types CRUD)",
    icon: Box,
    tools: [
      { name: "list_single_types", action: "READ", desc: "Daftar seluruh halaman statis/tunggal (misal: Homepage, About, Site Settings)", params: "none" },
      { name: "get_single_type", action: "READ", desc: "Mengambil skema field dan nilai konten aktual dari suatu Single Type", params: "singleTypeSlug" },
      { name: "create_single_type", action: "CREATE", desc: "Membuat skema Single Type baru beserta field dan konten awal", params: "name, slug, description?, fields[], initialData?" },
      { name: "update_single_type_content", action: "UPDATE", desc: "Menyimpan atau memperbarui data konten halaman statis", params: "singleTypeSlug, data, locale?" },
      { name: "delete_single_type", action: "DELETE", desc: "Menghapus Single Type dan data kontennya secara permanen", params: "singleTypeSlug" },
    ]
  },
  {
    groupName: "4. Komponen Bersarang (Components CRUD)",
    icon: Sparkles,
    tools: [
      { name: "list_components", action: "READ", desc: "Daftar seluruh komponen modular yang dapat disematkan di dalam Content & Single Types", params: "none" },
      { name: "create_component", action: "CREATE", desc: "Membuat komponen modular baru (misal: Hero Banner, Testimonial Card, FAQ Block)", params: "name, slug, category?, fields[]" },
      { name: "delete_component", action: "DELETE", desc: "Menghapus komponen modular dari workspace", params: "componentSlug" },
    ]
  },
  {
    groupName: "5. Webhook & Otomasi (Webhooks CRUD & Trigger)",
    icon: Webhook,
    tools: [
      { name: "list_webhooks", action: "READ", desc: "Daftar seluruh webhook aktif dan event yang dilanggan", params: "none" },
      { name: "create_webhook", action: "CREATE", desc: "Mendaftarkan webhook baru untuk event content.created, content.published, dll", params: "name, url, events[], secret?, hookType?" },
      { name: "update_webhook", action: "UPDATE", desc: "Memperbarui konfigurasi webhook, URL tujuan, atau status aktif", params: "id, name?, url?, events?, enabled?" },
      { name: "delete_webhook", action: "DELETE", desc: "Menghapus webhook dari sistem", params: "id" },
      { name: "test_webhook", action: "AUTOMATION", desc: "Mengirimkan sinyal uji (ping mock test) ke endpoint webhook untuk mengukur latensi dan HTTP status", params: "id" },
    ]
  }
]

export function MCPDashboardClient({ tenantSlug, tenantId, existingTokens }: MCPDashboardClientProps) {
  const { toast } = useToast()
  const [customBaseUrl, setCustomBaseUrl] = useState("")
  const [selectedToken, setSelectedToken] = useState<string>("")
  const [selectedPlatform, setSelectedPlatform] = useState<string>("v0")
  const [mounted, setMounted] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedConfig, setCopiedConfig] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (existingTokens.length > 0) {
      setSelectedToken(existingTokens[0].id)
    }
  }, [existingTokens])

  const origin = mounted && typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const baseUrl = (customBaseUrl || origin).replace(/\/$/, "")
  const mcpUrl = `${baseUrl}/api/mcp`

  const activePlatform = PLATFORMS.find(p => p.id === selectedPlatform) || PLATFORMS[0]
  const generatedJson = generateConfig(activePlatform.id, mcpUrl, "YOUR_API_TOKEN")

  const handleCopy = async (text: string, type: "url" | "config") => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === "url") {
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } else {
        setCopiedConfig(true)
        setTimeout(() => setCopiedConfig(false), 2000)
      }
      toast({ title: "Tersalin!", description: "Konfigurasi berhasil disalin ke clipboard." })
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" })
    }
  }

  const getActionBadge = (action: ToolItem["action"]) => {
    switch (action) {
      case "CREATE":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-bold rounded-full border shadow-none">CREATE</Badge>
      case "READ":
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px] font-bold rounded-full border shadow-none">READ</Badge>
      case "UPDATE":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[9px] font-bold rounded-full border shadow-none">UPDATE</Badge>
      case "DELETE":
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[9px] font-bold rounded-full border shadow-none">DELETE</Badge>
      case "AUTOMATION":
        return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[9px] font-bold rounded-full border shadow-none">TEST</Badge>
    }
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
                  <Plug className="h-4 w-4" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  Model Context Protocol (MCP) Server
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  Live CRUD
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Hubungkan AI Agent (v0.dev, Cursor, Antigravity, Claude Desktop, VS Code) untuk langsung merancang skema, memanipulasi konten dinamis, dan mengontrol webhook SaCMS.
              </p>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="h-9 rounded-xl text-xs font-bold border-border/80"
              asChild
            >
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
                <Globe className="w-3.5 h-3.5 mr-1.5" />
                Spesifikasi MCP
                <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
              </a>
            </Button>
          </div>

          {/* Quick Endpoint Banner */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <Server className="h-4 w-4 text-primary" />
                    Endpoint MCP Workspace ({tenantSlug})
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Gunakan URL ini di pengaturan MCP client atau project v0.dev Anda.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono font-bold rounded-full w-fit">
                  Transport: Streamable HTTP / SSE
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input 
                    value={mcpUrl}
                    readOnly
                    className="font-mono text-xs bg-muted/20 border-border/80 rounded-xl h-9 pr-10 text-foreground"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleCopy(mcpUrl, "url")}
                    className="absolute right-0 top-0 h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
                    title="Salin URL"
                  >
                    {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <Button 
                  onClick={() => handleCopy(mcpUrl, "url")}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  Salin Endpoint URL
                </Button>
              </div>

              <div className="p-3 bg-muted/20 border border-border/60 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span>Otentikasi: Gunakan <strong>Full-Access API Token</strong> untuk operasi CRUD atau <strong>Read-Only Token</strong> untuk pembacaan saja.</span>
                </div>
                <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs font-bold text-primary">
                  <a href={`/dashboard/${tenantSlug}/developer/api-keys`}>Kelola API Token &rarr;</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs: Setup Guides vs Tool Catalog */}
          <Tabs defaultValue="catalog" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-2 max-w-md h-auto gap-1">
              <TabsTrigger value="catalog" className="rounded-xl font-bold text-xs py-2">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Katalog Tool MCP ({TOOL_GROUPS.reduce((acc, g) => acc + g.tools.length, 0)} Tools)
              </TabsTrigger>
              <TabsTrigger value="clients" className="rounded-xl font-bold text-xs py-2">
                <Terminal className="h-3.5 w-3.5 mr-1.5" />
                Panduan Setup IDE & v0
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: TOOL CATALOG */}
            <TabsContent value="catalog" className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {TOOL_GROUPS.map((group, gIdx) => (
                  <Card key={gIdx} className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                    <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                      <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <group.icon className="h-4 w-4 text-primary" />
                        {group.groupName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border/40">
                      {group.tools.map((t, tIdx) => (
                        <div key={tIdx} className="p-4 px-5 hover:bg-muted/10 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                                {t.name}
                              </code>
                              {getActionBadge(t.action)}
                            </div>
                            <p className="text-xs text-muted-foreground">{t.desc}</p>
                          </div>
                          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/60">
                              params: {t.params}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 2: SETUP CLIENTS */}
            <TabsContent value="clients" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Platform Selector */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card lg:col-span-1">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      Pilih Platform Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-1.5">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlatform(p.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border",
                          selectedPlatform === p.id 
                            ? "bg-primary/10 border-primary/30 text-primary shadow-xs" 
                            : "border-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{p.icon}</span>
                          <span>{p.name}</span>
                        </div>
                        <Badge variant="outline" className={cn("text-[9px] font-bold rounded-full", p.badgeColor)}>
                          {p.badge}
                        </Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Configuration Details */}
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card lg:col-span-2 space-y-0 overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{activePlatform.icon}</span>
                        <div>
                          <CardTitle className="text-sm font-bold text-foreground">
                            Konfigurasi {activePlatform.name}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono text-muted-foreground mt-0.5">
                            File Target: {activePlatform.configPath}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-bold rounded-full border-border/60">
                        {activePlatform.badge}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-5">
                    
                    {/* Step-by-step instructions */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Langkah Integrasi:</h4>
                      <ol className="space-y-1.5 list-decimal list-inside text-xs text-foreground/90">
                        {activePlatform.steps.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Notes if any */}
                    {activePlatform.notes && (
                      <div className="p-3 bg-muted/20 border border-border/60 rounded-xl text-xs text-muted-foreground space-y-1">
                        {activePlatform.notes.map((note, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                            <span>{note}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Code Snippet Box */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-bold text-foreground">
                          {activePlatform.id === "v0" ? "Endpoint URL v0:" : "JSON Configuration Snippet:"}
                        </Label>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleCopy(generatedJson, "config")}
                          className="h-7 text-xs font-bold text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                        >
                          {copiedConfig ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                          {copiedConfig ? "Tersalin" : "Salin Konfigurasi"}
                        </Button>
                      </div>

                      <div className="relative rounded-xl border border-border/80 bg-neutral-950 text-neutral-100 p-4 font-mono text-xs overflow-x-auto select-all">
                        <pre>{generatedJson}</pre>
                      </div>
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
