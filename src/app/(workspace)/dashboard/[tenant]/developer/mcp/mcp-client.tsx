"use client"

import { useState, useEffect, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Copy, Check, Plug, Terminal, Bot, Globe, ExternalLink,
  Code2, Key, Server, Sparkles, Database, Layers, Webhook,
  Plus, Trash2, ShieldCheck, Loader2, Info, CheckCircle2,
  Cpu, Search, Image, GitBranch, FileCode2, Wand2, Lightbulb
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createMcpTokenAction, deleteMcpTokenAction } from "@/actions/mcp-tokens"

interface MCPTokenItem {
  id: string
  name: string
  type?: string
  token?: string
  description: string | null
  createdAt: string
  lastUsedAt?: string | null
}

interface ApiKeyItem {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsed?: string | null
}

interface MCPDashboardClientProps {
  tenantSlug: string
  tenantId: string
  existingTokens: MCPTokenItem[]
  existingApiKeys?: ApiKeyItem[]
}

// ─── Config generators per platform ──────────────────────────────────────────

function generateConfig(platform: string, mcpUrl: string, token: string = "YOUR_MCP_TOKEN"): string {
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
    id: "antigravity",
    name: "Antigravity (AGY)",
    icon: "⚡",
    badge: "Google DeepMind Agent",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    configPath: ".agents/mcp_config.json",
    steps: [
      "Buka atau buat file .agents/mcp_config.json di root workspace project Anda.",
      "Salin dan tempelkan blok JSON konfigurasi di bawah.",
      "Token otorisasi aktif otomatis disematkan pada konfigurasi.",
      "Antigravity akan otomatis mendeteksi server MCP 'sacms' saat proses tasking dimulai.",
      "Prompt contoh: 'Gunakan MCP sacms untuk query schema CMS dan buatkan Server Action untuk mutasi artikel.'"
    ]
  },
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
      "Tambahkan Header: Key 'Authorization', Value 'Bearer <TOKEN>'.",
      "Prompt contoh ke v0: 'Gunakan MCP SaCMS untuk membuat blog modern lengkap dengan Content Types articles, categories, dan ambil 5 data artikel pertama.'"
    ],
    notes: [
      "v0 dapat langsung membuat skema Content Type baru, mengisi data contoh, dan merender komponen React/Next.js interaktif."
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
      "Tambahkan Header: Authorization: Bearer <TOKEN>.",
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
      "Buka panel Cline di VS Code → klik icon Settings (Gear) → MCP Servers.",
      "Tambahkan konfigurasi server 'sacms'.",
      "Cline akan menampilkan daftar 22 tools aktif yang siap digunakan."
    ]
  }
]

// ─── Live Catalog Tools List ─────────────────────────────────────────────────

interface McpToolDoc {
  name: string
  category: "schema" | "content" | "single" | "webhook"
  description: string
  inputs: string[]
}

const MCP_TOOLS_CATALOG: McpToolDoc[] = [
  { name: "get_full_schema", category: "schema", description: "Mengambil seluruh struktur Content Types, Single Types, dan Components workspace sekaligus.", inputs: [] },
  { name: "list_content_types", category: "schema", description: "Mendaftar seluruh model koleksi konten beserta skema field dan jumlah entri aktif.", inputs: [] },
  { name: "get_content_type", category: "schema", description: "Mendapatkan skema detail dari Content Type tertentu berdasarkan slug atau ID.", inputs: ["slug"] },
  { name: "create_content_type", category: "schema", description: "Membuat Content Type (koleksi) baru lengkap dengan daftar field skema.", inputs: ["name", "slug", "description", "fields"] },
  { name: "update_content_type", category: "schema", description: "Menambah, mengedit, atau menghapus field pada Content Type yang ada.", inputs: ["slug", "name", "fields"] },
  { name: "delete_content_type", category: "schema", description: "Menghapus model Content Type dan seluruh entri data di dalamnya.", inputs: ["slug"] },

  { name: "list_entries", category: "content", description: "Query entri data dengan filter Strapi, pencarian teks, sort, pagination, dan populate relasi.", inputs: ["contentTypeSlug", "page", "pageSize", "search", "filters", "sort", "populate"] },
  { name: "get_entry", category: "content", description: "Mengambil satu entri konten spesifik berdasarkan ID dengan relasi data ter-populate.", inputs: ["contentTypeSlug", "id", "locale", "populate"] },
  { name: "create_entry", category: "content", description: "Menambahkan entri konten baru dengan status DRAFT atau langsung PUBLISHED.", inputs: ["contentTypeSlug", "data", "status", "locale"] },
  { name: "update_entry", category: "content", description: "Memperbarui nilai field pada entri konten yang sudah ada.", inputs: ["contentTypeSlug", "id", "data", "status"] },
  { name: "delete_entry", category: "content", description: "Menghapus entri konten dari database.", inputs: ["contentTypeSlug", "id"] },
  { name: "bulk_create_entries", category: "content", description: "Memasukkan banyak entri konten sekaligus (batch seeding / import).", inputs: ["contentTypeSlug", "entries", "status"] },
  { name: "bulk_delete_entries", category: "content", description: "Menghapus beberapa entri konten secara bersamaan berdasarkan daftar ID.", inputs: ["contentTypeSlug", "ids"] },

  { name: "get_single_type", category: "single", description: "Mengambil data halaman tunggal (misal: Homepage, Pengaturan Website, Footer).", inputs: ["slug", "locale"] },
  { name: "update_single_type", category: "single", description: "Menyimpan dan mempublikasikan data pada model Single Type.", inputs: ["slug", "data", "publish", "locale"] },
  { name: "create_single_type", category: "single", description: "Mendefinisikan model Single Type baru di workspace.", inputs: ["name", "slug", "description", "fields"] },
  { name: "list_components", category: "single", description: "Mendaftar seluruh blok komponen reusable (CTA, Hero, Feature Card).", inputs: [] },
  { name: "create_component", category: "single", description: "Membuat komponen skema baru untuk dipakai berulang di Content Type.", inputs: ["name", "slug", "category", "fields"] },

  { name: "list_webhooks", category: "webhook", description: "Mendaftar webhook event yang aktif di workspace.", inputs: [] },
  { name: "create_webhook", category: "webhook", description: "Mendaftarkan webhook baru untuk trigger deploy Vercel/Netlify atau notifikasi.", inputs: ["name", "url", "events", "secret"] },
  { name: "delete_webhook", category: "webhook", description: "Menghapus endpoint webhook.", inputs: ["id"] },
  { name: "get_api_docs", category: "webhook", description: "Mengambil panduan REST & GraphQL API lengkap beserta contoh fetch Next.js.", inputs: [] },
]

export function MCPDashboardClient({
  tenantSlug,
  tenantId,
  existingTokens,
  existingApiKeys = [],
}: MCPDashboardClientProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Protocol MCP Base URL
  const [mcpUrl, setMcpUrl] = useState("")
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
    setMcpUrl(`${origin}/api/mcp`)
  }, [])

  // Token management state
  const [tokens, setTokens] = useState<MCPTokenItem[]>(existingTokens)
  const [apiKeys] = useState<ApiKeyItem[]>(existingApiKeys)
  const [newTokenName, setNewTokenName] = useState("")
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [generatedPlainToken, setGeneratedPlainToken] = useState<string | null>(null)
  const [selectedTokenValue, setSelectedTokenValue] = useState<string>("")
  const [copiedToken, setCopiedToken] = useState(false)
  const [activePlatform, setActivePlatform] = useState("antigravity")

  // Auto select default token if exists
  useEffect(() => {
    if (!selectedTokenValue) {
      if (tokens.length > 0 && tokens[0].token) {
        setSelectedTokenValue(tokens[0].token)
      } else if (apiKeys.length > 0) {
        setSelectedTokenValue(apiKeys[0].key)
      }
    }
  }, [tokens, apiKeys, selectedTokenValue])

  const handleCopy = async (text: string, label: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Disalin!",
        description: `${label} berhasil disalin ke clipboard`,
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Gagal menyalin ${label.toLowerCase()}`,
      })
    }
  }

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      toast({
        variant: "destructive",
        title: "Nama Token Wajib",
        description: "Masukkan nama deskriptif untuk token MCP Anda (misal: Cursor Dev)",
      })
      return
    }

    startTransition(async () => {
      const res = await createMcpTokenAction(tenantSlug, {
        name: newTokenName.trim(),
        description: `MCP Server Access for ${tenantSlug}`,
      })

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Gagal Membuat Token",
          description: res.error,
        })
      } else {
        setGeneratedPlainToken(res.plainToken || null)
        if (res.plainToken) {
          setSelectedTokenValue(res.plainToken)
        }
        if (res.token) {
          setTokens(prev => [{
            id: res.token.id,
            name: res.token.name,
            type: "mcp",
            token: res.plainToken || (res.token as any)?.token || "",
            description: res.token.description,
            createdAt: new Date().toISOString(),
          }, ...prev])
        }
        setNewTokenName("")
        setShowGenerateModal(false)
        toast({
          title: "Token MCP Berhasil Dibuat!",
          description: "Salin token Anda sekarang untuk dipasang di AI Client Anda.",
        })
      }
    })
  }

  const handleDeleteToken = (tokenId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus token MCP ini? AI Editor yang menggunakan token ini tidak akan bisa mengakses workspace lagi.")) return

    startTransition(async () => {
      const res = await deleteMcpTokenAction(tenantSlug, tokenId)
      if (res.error) {
        toast({
          variant: "destructive",
          title: "Gagal Menghapus",
          description: res.error,
        })
      } else {
        setTokens(prev => prev.filter(t => t.id !== tokenId))
        toast({
          title: "Token Dihapus",
          description: "Token MCP telah dicabut.",
        })
      }
    })
  }

  const currentPlatformInfo = PLATFORMS.find(p => p.id === activePlatform) || PLATFORMS[0]
  const effectiveToken = selectedTokenValue || generatedPlainToken || "YOUR_MCP_TOKEN"

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Model Context Protocol (MCP)</h1>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
                    v2.0 SSE Live
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hubungkan AI Editor (Antigravity, Cursor, Claude, v0.dev, VS Code, Windsurf) ke SaCMS untuk manipulasi skema dan data real-time.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowGenerateModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs shrink-0"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Generate Token MCP Baru
            </Button>
          </div>

          {/* MCP Server Endpoint & Active Token Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            {/* Server URL Card */}
            <Card className="lg:col-span-6 rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <p className="text-xs font-bold text-foreground">MCP Server Endpoint (Streamable SSE / HTTP)</p>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  URL protokol tunggal untuk seluruh AI Editor dan subagent.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={mcpUrl || "http://localhost:3000/api/mcp"}
                  readOnly
                  className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9 text-foreground"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(mcpUrl, "MCP Server URL")}
                  className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin URL
                </Button>
              </div>
            </Card>

            {/* Active Token & Key Selector */}
            <Card className="lg:col-span-6 rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold text-foreground">Kunci Otorisasi Aktif (Active Token / Key)</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md bg-muted/30">
                    Bearer Auth
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pilih token atau API key untuk otomatis disematkan pada snippet konfigurasi di bawah.
                </p>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={effectiveToken}
                    onChange={(e) => setSelectedTokenValue(e.target.value)}
                    placeholder="Masukkan token mcp_... atau cf_..."
                    className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9 text-foreground"
                  />
                </div>

                {(tokens.length > 0 || apiKeys.length > 0) && (
                  <Select value={selectedTokenValue} onValueChange={setSelectedTokenValue}>
                    <SelectTrigger className="h-9 w-36 rounded-xl text-xs bg-background border-border/80 shrink-0 font-medium">
                      <SelectValue placeholder="Pilih Kunci" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {tokens.map((t) => (
                        <SelectItem key={t.id} value={t.token || t.id} className="text-xs font-mono">
                          Token: {t.name}
                        </SelectItem>
                      ))}
                      {apiKeys.map((k) => (
                        <SelectItem key={k.id} value={k.key} className="text-xs font-mono">
                          API Key: {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    handleCopy(effectiveToken, "Token Otorisasi")
                    setCopiedToken(true)
                    setTimeout(() => setCopiedToken(false), 2000)
                  }}
                  className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
                >
                  {copiedToken ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copiedToken ? "Disalin!" : "Salin"}
                </Button>
              </div>
            </Card>

          </div>

          {/* Generated Token Success Callout */}
          {generatedPlainToken && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Token Baru Dibuat & Diaktifkan</p>
                  <p className="text-muted-foreground font-mono text-[11px] mt-0.5">{generatedPlainToken}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 rounded-xl text-xs font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                onClick={() => handleCopy(generatedPlainToken, "Token MCP Baru")}
              >
                Salin Token
              </Button>
            </div>
          )}

          {/* Platform Setup Guides */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold tracking-tight text-foreground">Panduan Konfigurasi AI Editor</h2>
                <p className="text-xs text-muted-foreground">Pilih platform editor AI Anda untuk melihat konfigurasi siap pakai.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {PLATFORMS.map((p) => {
                const isActive = activePlatform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatform(p.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all duration-150",
                      isActive
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                        : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-xs font-bold text-foreground leading-tight">{p.name}</span>
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 rounded-md font-bold uppercase", p.badgeColor)}>
                      {p.badge.split(" ")[0]}
                    </Badge>
                  </button>
                )
              })}
            </div>

            {/* Platform Detail & JSON Configuration Card */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{currentPlatformInfo.icon}</span>
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      Setup {currentPlatformInfo.name}
                      <Badge className={cn("text-[10px] font-bold", currentPlatformInfo.badgeColor)}>
                        {currentPlatformInfo.badge}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Lokasi Konfigurasi: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] text-foreground font-bold">{currentPlatformInfo.configPath}</code>
                    </CardDescription>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleCopy(generateConfig(currentPlatformInfo.id, mcpUrl, effectiveToken), `Konfigurasi ${currentPlatformInfo.name}`)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 rounded-xl shadow-xs shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Salin Konfigurasi JSON
                </Button>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {/* Steps List */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Langkah-Langkah Integrasi:</p>
                  <ol className="space-y-1.5 text-xs text-foreground list-decimal list-inside leading-relaxed">
                    {currentPlatformInfo.steps.map((step, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        <span className="text-foreground font-medium">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* JSON Code Snippet */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">File Konfigurasi ({currentPlatformInfo.configPath})</Label>
                    <span className="text-[10px] text-muted-foreground font-mono">Token otomatis terinjeksi</span>
                  </div>
                  <pre className="p-4 bg-muted/40 rounded-xl border border-border/80 font-mono text-xs text-foreground overflow-x-auto">
                    {generateConfig(currentPlatformInfo.id, mcpUrl, effectiveToken)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Catalog Tools & Recommendations Tabs */}
          <Tabs defaultValue="catalog" className="space-y-4">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-2 max-w-md h-auto gap-1">
              <TabsTrigger value="catalog" className="rounded-xl font-bold text-xs py-2">
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                22 Live Tools MCP Aktif
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="rounded-xl font-bold text-xs py-2">
                <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                Rekomendasi MCP Baru 💡
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: 22 LIVE TOOLS */}
            <TabsContent value="catalog" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {MCP_TOOLS_CATALOG.map((tool) => (
                  <Card key={tool.name} className="rounded-2xl border-border/80 shadow-xs bg-card p-4 space-y-2 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                        {tool.name}
                      </code>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md">
                        {tool.category}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {tool.description}
                    </p>
                    {tool.inputs.length > 0 && (
                      <div className="pt-1 flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-semibold">Params:</span>
                        {tool.inputs.map((param) => (
                          <span key={param} className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                            {param}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* TAB 2: RECOMMENDED MCP TOOLS */}
            <TabsContent value="recommendations" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Media Assets */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Image className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Media & Cloudflare R2 Management MCP Tool</h3>
                      <p className="text-[11px] text-muted-foreground">Upload gambar via URL langsung dari prompt AI agent.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Memungkinkan AI agent mengunduh gambar dari internet, mengunggahnya ke Cloudflare R2 bucket SaCMS, menghasilkan thumbnail, dan mengaitkan media tersebut ke field entri artikel atau produk.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">upload_media_by_url</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">list_media_assets</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">delete_media_asset</code>
                  </div>
                </Card>

                {/* 2. Vector & Semantic Search */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Search className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Semantic Vector Search MCP Tool (Pgvector)</h3>
                      <p className="text-[11px] text-muted-foreground">Pencarian konten berbasis makna dan konteks semantik.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI agent dapat mencari entri artikel yang relevan secara konseptual menggunakan embedding vector tanpa harus bergantung pada pencarian kata kunci eksak (keyword matching).
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">semantic_search_entries</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">get_similar_articles</code>
                  </div>
                </Card>

                {/* 3. Workflow State Machine */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <GitBranch className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Content Workflow & Review Approval Tool</h3>
                      <p className="text-[11px] text-muted-foreground">Kontrol siklus status draft, review, dan scheduled publish.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Memfasilitasi AI workflow automation untuk mengajukan review konten (<code className="font-mono text-[10px]">IN_REVIEW</code>), menyetujui artikel (<code className="font-mono text-[10px]">APPROVED</code>), atau menjadwalkan publish otomatis.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">publish_entry</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">schedule_publish</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">request_content_review</code>
                  </div>
                </Card>

                {/* 4. Automated TypeScript SDK Generator */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileCode2 className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Export TypeScript Interfaces & SDK Generator</h3>
                      <p className="text-[11px] text-muted-foreground">Otomatisasi pembuatan tipe data frontend Next.js.</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI Editor dapat meminta MCP untuk langsung meng-generate file <code className="font-mono text-[10px]">types/sacms.ts</code> dan klien fetch yang 100% type-safe sesuai skema Content Type yang baru dibuat.
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">export_typescript_types</code>
                    <code className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded text-foreground font-bold">generate_sdk_client</code>
                  </div>
                </Card>

              </div>
            </TabsContent>

          </Tabs>

          {/* Generate Token Modal */}
          <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground">Generate Token MCP Baru</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Buat token otorisasi khusus untuk menghubungkan Antigravity, Cursor, Claude Desktop, atau v0.dev.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mcp-name" className="text-xs font-semibold text-foreground">Nama Klien / Editor</Label>
                  <Input
                    id="mcp-name"
                    placeholder="Contoh: Antigravity IDE / Cursor Local"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80"
                  />
                </div>
                <div className="p-3 bg-muted/30 border border-border/60 rounded-xl text-xs text-muted-foreground">
                  Token ini memiliki hak akses penuh untuk membaca skema, mengubah model konten, dan mengelola entri data melalui protokol MCP.
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button variant="outline" onClick={() => setShowGenerateModal(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">
                  Batal
                </Button>
                <Button onClick={handleCreateToken} disabled={isPending} className="rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground">
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  {isPending ? "Membuat Token..." : "Generate Token"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </div>
  )
}
