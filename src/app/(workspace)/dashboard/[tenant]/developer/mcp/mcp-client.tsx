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
import Link from "next/link"
import { 
  Copy, Check, Plug, Terminal, Bot, Globe, ExternalLink,
  Code2, Key, Server, Sparkles, Database, Layers, Webhook,
  Plus, Trash2, ShieldCheck, Loader2, Info, CheckCircle2,
  Cpu, Search, Image, GitBranch, FileCode2, Wand2, Lightbulb,
  Lock, AlertTriangle, ArrowUpRight, HardDrive, Download, FileCode, BookOpen
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
  plan?: string
  isPaid?: boolean
  hostingType?: "shared_vercel" | "dedicated_vps"
  subscriptionStatus?: string
  vpsDetails?: {
    hostname: string | null
    ipv4: string | null
    status: string
    plan: string
    cpuCount: number
    ramMb: number
  } | null
  existingTokens: MCPTokenItem[]
  existingApiKeys?: ApiKeyItem[]
}

// ─── Config generators per platform ──────────────────────────────────────────

function generateConfig(platform: string, mcpUrl: string, token: string = "YOUR_MCP_TOKEN", tenantSlug: string = "workspace"): string {
  const origin = mcpUrl ? mcpUrl.replace(/\/api\/mcp\/?$/, "") : "http://localhost:3000"
  const openApiUrl = `${origin}/api/public/${tenantSlug}/openapi.json`
  const geminiToolsUrl = `${origin}/api/public/${tenantSlug}/gemini-tools`

  switch (platform) {
    case "chatgpt":
      return JSON.stringify({
        schema_url: openApiUrl,
        auth: {
          type: "apiKey",
          authType: "bearer",
          token: token
        },
        privacy_policy_url: `${origin}/privacy`,
        instructions: `Anda adalah AI Content Manager untuk SaCMS workspace '${tenantSlug}'. Gunakan actions yang tersedia untuk mengambil struktur data, menulis atau mempublikasikan artikel/produk, dan membaca data halaman singleton.`
      }, null, 2)

    case "gemini":
      return `// ─── Google Gemini / Google AI Studio Integration ───
// 1. Tool Declaration Endpoint (Copy-paste JSON or fetch dynamically):
// ${geminiToolsUrl}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Fetch active tool schema dynamically from SaCMS
const toolsRes = await fetch("${geminiToolsUrl}");
const { tools } = await toolsRes.json();

const response = await ai.models.generateContent({
  model: "gemini-2.0-flash",
  contents: "Daftarkan 5 artikel terbaru dari SaCMS dan buatkan ringkasan.",
  config: { tools }
});

console.log(response.text);`

    case "manus":
      return JSON.stringify({
        mcp_servers: [
          {
            name: "sacms",
            transport: "streamable-http",
            url: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        ],
        custom_tools_openapi: openApiUrl,
        instructions: `Integrate with SaCMS Headless CMS. Use 'sacms' MCP tools to perform schema introspection and content management.`
      }, null, 2)

    case "emergent":
      return JSON.stringify({
        agent_connectors: {
          sacms_mcp: {
            endpoint: mcpUrl,
            headers: {
              Authorization: `Bearer ${token}`
            }
          },
          sacms_openapi: {
            spec_url: openApiUrl,
            auth_header: `Bearer ${token}`
          }
        }
      }, null, 2)

    case "contabo":
      return JSON.stringify({
        mcpServers: {
          sacms: {
            command: "bunx",
            args: [
              "sacms-mcp",
              "--host",
              origin,
              "--token",
              token
            ]
          }
        }
      }, null, 2)

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
    badge: "DeepMind Agent",
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
    id: "chatgpt",
    name: "ChatGPT Actions",
    icon: "🤖",
    badge: "Custom GPTs",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    configPath: "GPT Builder → Configure → Create new action",
    steps: [
      "Buka chatgpt.com → Klik profil → My GPTs → Create a GPT.",
      "Masuk ke tab 'Configure', scroll ke bawah ke bagian 'Actions' dan klik 'Create new action'.",
      "Klik tombol 'Import from URL' dan masukkan URL OpenAPI Schema publik di bawah.",
      "Di bagian 'Authentication', pilih 'API Key', Auth Type 'Bearer', dan masukkan Token Otorisasi Anda.",
      "Set URL Kebijakan Privasi dengan: https://your-domain/privacy.",
      "Instruksi contoh: 'Anda adalah Asisten CMS. Gunakan actions untuk membuat artikel baru saat user meminta.'"
    ],
    notes: [
      "OpenAPI 3.1 schema ter-generate secara dinamis sesuai Content Types dan Single Types di workspace Anda."
    ]
  },
  {
    id: "gemini",
    name: "Google AI Studio",
    icon: "✨",
    badge: "Gemini 2.0 / Flash",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    configPath: "Google AI Studio → Tools → Function Calling",
    steps: [
      "Buka aistudio.google.com dan buat chat prompt baru.",
      "Pada panel sebelah kanan, aktifkan 'Tools' → pilih 'Function calling' / 'Structured Output'.",
      "Buka endpoint Gemini Tools URL untuk menyalin seluruh functionDeclarations JSON.",
      "Atau gunakan Google GenAI SDK (Node.js/Python) dengan mem-fetch schema secara otomatis seperti snippet di bawah.",
      "Gemini sekarang dapat memanggil tool 'sacms_list_entries', 'sacms_create_entry', dsb secara autonomous."
    ]
  },
  {
    id: "manus",
    name: "Manus AI",
    icon: "🧠",
    badge: "Autonomous Agent",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    configPath: "Manus Settings → MCP Connectors / Custom Tools",
    steps: [
      "Buka Manus Agent Dashboard → Settings → Integrations.",
      "Tambahkan MCP Server baru dengan transport 'Streamable HTTP / SSE'.",
      "Masukkan URL MCP SaCMS dan tambahkan Header 'Authorization: Bearer <TOKEN>'.",
      "Manus akan langsung mengenali seluruh 22 capabilities CMS untuk mengelola website."
    ]
  },
  {
    id: "emergent",
    name: "Emergent AI",
    icon: "🌐",
    badge: "Agent Mesh",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    configPath: "Emergent Agent Studio → Integrations → MCP",
    steps: [
      "Di Emergent Agent Studio, buka menu Agent Connections.",
      "Pilih 'Model Context Protocol (MCP)' dan masukkan Endpoint URL SaCMS.",
      "Sematkan API Token Anda untuk autentikasi workspace.",
      "Emergent siap mengotomatisasi pipeline konten multi-channel."
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
    id: "contabo",
    name: "Contabo VPS (CLI)",
    icon: "🖥️",
    badge: "Dedicated Stdio CLI",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    configPath: "Terminal CLI / Claude Stdio Bridge",
    steps: [
      "Gunakan perintah CLI 'bunx sacms-mcp' atau 'npx sacms-mcp' untuk menjembatani stdio lokal ke server SaCMS di VPS Contabo.",
      "Bagus untuk autonomous background worker atau pemrosesan batch yang membutuhkan waktu eksekusi tanpa batas (bypass serverless timeouts).",
      "Jalankan di terminal lokal atau masukkan ke claude_desktop_config.json dengan command 'bunx'."
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
  },
  {
    id: "v0",
    name: "v0.dev",
    icon: "🔺",
    badge: "UI Generator",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    configPath: "v0.dev Project Settings → MCP",
    steps: [
      "Buka chat v0.dev atau menu Project Settings pada project Anda.",
      "Navigasi ke menu 'MCP Servers' atau 'Integrations'.",
      "Klik tombol '+ Add MCP Server' dan pilih koneksi HTTP / SSE.",
      "Masukkan Server URL dengan URL MCP SaCMS di bawah.",
      "Tambahkan Header: Key 'Authorization', Value 'Bearer <TOKEN>'.",
      "Prompt contoh ke v0: 'Gunakan MCP SaCMS untuk membuat blog modern lengkap dengan Content Types articles, categories, dan ambil 5 data artikel pertama.'"
    ]
  }
]

// ─── Live Catalog Tools List ─────────────────────────────────────────────────

interface McpToolDoc {
  name: string
  category: "schema" | "content" | "single" | "webhook" | "hosting"
  description: string
  inputs: string[]
}

const MCP_TOOLS_CATALOG: McpToolDoc[] = [
  { name: "get_full_schema", category: "schema", description: "Mengambil seluruh struktur Content Types, Single Types, dan Components workspace sekaligus.", inputs: [] },
  { name: "list_field_types", category: "schema", description: "Mendaftar seluruh 33 tipe field resmi SaCMS (textarea, richText, currency, relation, repeater, mediaMultiple, dll.) beserta format opsi konfigurasi.", inputs: ["category?"] },
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
  { name: "update_webhook", category: "webhook", description: "Memperbarui URL target, event trigger, atau status aktif endpoint webhook.", inputs: ["id", "url", "events", "enabled"] },
  { name: "delete_webhook", category: "webhook", description: "Menghapus endpoint webhook.", inputs: ["id"] },
  { name: "test_webhook", category: "webhook", description: "Mengirimkan test ping payload ke endpoint webhook untuk verifikasi koneksi.", inputs: ["id"] },
  { name: "get_api_docs", category: "webhook", description: "Mengambil panduan REST & GraphQL API lengkap beserta contoh fetch Next.js.", inputs: [] },
  { name: "inspect_api_capabilities", category: "webhook", description: "Memeriksa fitur live gateway API publik, filtering Strapi, dan status webhook.", inputs: [] },
  { name: "get_api_info", category: "webhook", description: "Mengambil informasi dasar versi API SaCMS dan spesifikasi server MCP.", inputs: [] },

  // Multi-Tenant End-User & Member Auth MCP Tools
  { name: "list_members", category: "member", description: "Mendaftar akun end-user/member website dengan filter search, role (vip, member), dan status.", inputs: ["page", "pageSize", "search", "role", "status"] },
  { name: "get_member", category: "member", description: "Mengambil data detail profil member, metadata kustom, dan riwayat sesi aktif.", inputs: ["idOrEmail"] },
  { name: "create_member", category: "member", description: "Mendaftarkan member baru secara programmatic dengan password ter-hash bcrypt 12 rounds.", inputs: ["email", "password", "name", "role", "metadata"] },
  { name: "update_member", category: "member", description: "Mengubah status member (active/suspended), role, password baru, atau metadata kustom.", inputs: ["idOrEmail", "name", "role", "status", "password", "metadata"] },
  { name: "delete_member", category: "member", description: "Menghapus akun member dan me-revoke seluruh sesi login aktif secara permanen.", inputs: ["idOrEmail"] },

  // Hosting & Cloud Deployment MCP Tools
  { name: "deploy_to_vercel", category: "hosting", description: "Deploy file source code website / frontend langsung ke Vercel Serverless hosting.", inputs: ["projectName", "files", "envVars"] },
  { name: "get_vercel_deployment_status", category: "hosting", description: "Mengecek status build dan URL produksi dari deployment Vercel.", inputs: ["deploymentId"] },
  { name: "configure_vercel_domain", category: "hosting", description: "Menghubungkan dan memverifikasi domain kustom pada project Vercel.", inputs: ["projectId", "domain"] },
  { name: "get_contabo_infrastructure_status", category: "hosting", description: "Memeriksa status live kesehatan server VPS Contabo, CPU, RAM, dan database dedicated.", inputs: [] },
  { name: "provision_contabo_vps", category: "hosting", description: "Menjalankan provisioning otomatis server Dedicated VPS Contabo untuk workspace berbayar.", inputs: ["plan", "region"] },
]

export function MCPDashboardClient({
  tenantSlug,
  tenantId,
  plan = "free",
  isPaid = false,
  hostingType = "shared_vercel",
  subscriptionStatus = "inactive",
  vpsDetails = null,
  existingTokens,
  existingApiKeys = [],
}: MCPDashboardClientProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  // Protocol MCP Base URL
  const [mcpUrl, setMcpUrl] = useState("")
  useEffect(() => {
    if (hostingType === "dedicated_vps" && vpsDetails?.hostname) {
      setMcpUrl(`https://${vpsDetails.hostname}/api/mcp`)
    } else if (hostingType === "dedicated_vps" && vpsDetails?.ipv4) {
      setMcpUrl(`http://${vpsDetails.ipv4}:3000/api/mcp`)
    } else {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
      setMcpUrl(`${origin}/api/mcp`)
    }
  }, [hostingType, vpsDetails])

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
        title: "Gagal Menyalin",
        description: `Gagal menyalin ${label.toLowerCase()}`,
      })
    }
  }

  const handleDownloadConfigFile = (platformId: string) => {
    const snippet = generateConfig(platformId, mcpUrl, effectiveToken, tenantSlug)
    let filename = "mcp_config.json"
    if (platformId === "cursor") filename = "mcp.json"
    else if (platformId === "vscode") filename = "mcp.json"
    else if (platformId === "claude") filename = "claude_desktop_config.json"
    else if (platformId === "cline") filename = "cline_mcp_settings.json"

    const blob = new Blob([snippet], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "File Konfigurasi Diunduh!",
      description: `File ${filename} berhasil diunduh. Letakkan di folder project sesuai petunjuk.`,
    })
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

          {/* Payment & Hosting Plan Status Card */}
          {!isPaid ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">Akses MCP & AI Tools Terkunci (Langganan Belum Aktif)</h3>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/20 border-amber-500/30 text-amber-800 dark:text-amber-300 font-bold uppercase">
                      Status: {subscriptionStatus}
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 max-w-2xl">
                    Endpoint MCP, OpenAPI 3.1 untuk ChatGPT, dan Gemini Function Calling hanya dapat diakses saat workspace memiliki status pembayaran <strong>PAID</strong>. Silakan aktifkan langganan Anda untuk mulai menghubungkan agent AI.
                  </p>
                </div>
              </div>
              <Link href={`/dashboard/${tenantSlug}/subscriptions`}>
                <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0 shadow-sm">
                  Aktifkan / Bayar Langganan <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                  hostingType === "dedicated_vps" 
                    ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                )}>
                  {hostingType === "dedicated_vps" ? <Cpu className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">
                      {hostingType === "dedicated_vps" ? "Dedicated Contabo VPS Appliance" : "Vercel Serverless (Shared Cloud)"}
                    </span>
                    <Badge className={cn(
                      "text-[9px] font-bold uppercase px-2 py-0.5",
                      hostingType === "dedicated_vps"
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    )}>
                      Plan: {plan.toUpperCase()} • PAID
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {hostingType === "dedicated_vps" && vpsDetails ? (
                      <>Instance VPS aktif: <strong>{vpsDetails.hostname || vpsDetails.ipv4}</strong> ({vpsDetails.cpuCount} vCPU, {Math.round(vpsDetails.ramMb / 1024)}GB RAM) • Unbuffered Native SSE Stream</>
                    ) : (
                      <>Berjalan di Vercel Serverless Edge Pool dengan auto-scaling dan shared multi-tenant database pool.</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5 font-mono">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> MCP Online
                </Badge>
              </div>
            </div>
          )}

          {/* Universal AI Endpoints & Active Token Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Server URL Card (MCP) */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <p className="text-xs font-bold text-foreground">MCP Server (HTTP / SSE)</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md bg-muted/30">
                    Cursor / Claude / AGY
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Endpoint JSON-RPC 2.0 untuk seluruh MCP-compatible agent.
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
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin
                </Button>
              </div>
            </Card>

            {/* OpenAPI 3.1 Endpoint Card (ChatGPT Actions) */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-xs font-bold text-foreground">OpenAPI 3.1 Spec</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    ChatGPT Actions
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Schema spesifikasi REST publik untuk Custom GPTs & Actions.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={mcpUrl ? `${mcpUrl.replace(/\/api\/mcp\/?$/, "")}/api/public/${tenantSlug}/openapi.json` : `/api/public/${tenantSlug}/openapi.json`}
                  readOnly
                  className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9 text-foreground"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(`${mcpUrl.replace(/\/api\/mcp\/?$/, "")}/api/public/${tenantSlug}/openapi.json`, "OpenAPI Spec URL")}
                  className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin
                </Button>
              </div>
            </Card>

            {/* Gemini Function Tools Card (Google AI Studio) */}
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-bold text-foreground">Google Gemini Tools JSON</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                    AI Studio / SDK
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Definisi Function Calling siap pakai di Google AI Studio.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  value={mcpUrl ? `${mcpUrl.replace(/\/api\/mcp\/?$/, "")}/api/public/${tenantSlug}/gemini-tools` : `/api/public/${tenantSlug}/gemini-tools`}
                  readOnly
                  className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9 text-foreground"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(`${mcpUrl.replace(/\/api\/mcp\/?$/, "")}/api/public/${tenantSlug}/gemini-tools`, "Gemini Tools URL")}
                  className="h-9 px-3 rounded-xl text-xs font-bold shrink-0"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin
                </Button>
              </div>
            </Card>

          </div>

          {/* Active Token & Key Selector Bar */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-foreground">Kunci Otorisasi Aktif (Active Token / API Key)</p>
                  <Badge variant="outline" className="text-[9px] font-bold uppercase rounded-md bg-muted/30">
                    Bearer Auth
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Token terpilih akan otomatis diinjeksikan pada seluruh contoh konfigurasi dan instruksi di bawah.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-48 sm:w-64">
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
                <h2 className="text-base font-bold tracking-tight text-foreground">Pilih Ekosistem AI & Platform Editor</h2>
                <p className="text-xs text-muted-foreground">Pilih platform AI Anda untuk melihat panduan setup step-by-step dan file konfigurasi instan.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {PLATFORMS.map((p) => {
                const isActive = activePlatform === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlatform(p.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border text-center transition-all duration-150",
                      isActive
                        ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30"
                        : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="text-2xl">{p.icon}</span>
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

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadConfigFile(currentPlatformInfo.id)}
                    className="border-border/80 text-foreground font-bold text-xs h-8 rounded-xl shadow-xs"
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Unduh File (.json)
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleCopy(generateConfig(currentPlatformInfo.id, mcpUrl, effectiveToken, tenantSlug), `Konfigurasi ${currentPlatformInfo.name}`)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 rounded-xl shadow-xs"
                  >
                    <Copy className="h-3.5 w-3.5 mr-1.5" />
                    Salin Konfigurasi
                  </Button>
                </div>
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
                    {generateConfig(currentPlatformInfo.id, mcpUrl, effectiveToken, tenantSlug)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Catalog Tools, IDE Prompt Recipes & Recommendations Tabs */}
          <Tabs defaultValue="catalog" className="space-y-4">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-3 max-w-lg h-auto gap-1">
              <TabsTrigger value="catalog" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                36 Tools Live
              </TabsTrigger>
              <TabsTrigger value="recipes" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                IDE Recipes 🚀
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
                <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                Rekomendasi 💡
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: 36 LIVE TOOLS */}
            <TabsContent value="catalog" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {MCP_TOOLS_CATALOG.map((tool) => (
                  <Card key={tool.name} className="rounded-2xl border-border/80 shadow-xs bg-card p-4 space-y-2 hover:border-primary/40 transition-colors">
                    <div className="flex items-center justify-between">
                      <code className="text-xs font-bold text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                        {tool.name}
                      </code>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[9px] font-bold uppercase rounded-md",
                          tool.category === "hosting" && "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
                          tool.category === "schema" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
                          tool.category === "content" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
                          tool.category === "single" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
                          tool.category === "webhook" && "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
                          tool.category === "member" && "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
                        )}
                      >
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

            {/* TAB 2: IDE PROMPT RECIPES & SCAFFOLDER */}
            <TabsContent value="recipes" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Recipe 1: Typegen */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold">
                        TypeScript
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">1. Auto-Generate TypeScript Types</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy("Gunakan MCP sacms tool get_full_schema. Tolong generate file types/sacms.d.ts yang mendefinisikan TypeScript interface 100% type-safe untuk seluruh Content Types, Single Types, dan Components di workspace ini lengkap dengan JSDoc documentation.", "Prompt Typegen")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Menghasilkan file deklarasi TypeScript (`.d.ts`) otomatis dari skema database live SaCMS untuk autocompletion di IDE.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Gunakan MCP sacms tool get_full_schema. Tolong generate file types/sacms.d.ts yang mendefinisikan TypeScript interface 100% type-safe untuk seluruh Content Types, Single Types, dan Components di workspace ini lengkap dengan JSDoc documentation.
                  </pre>
                </Card>

                {/* Recipe 2: Next.js 16 Scaffolder */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                        Next.js 16
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">2. Scaffold Halaman Listing & Detail</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy("Gunakan MCP sacms tool get_content_type untuk koleksi 'articles'. Buatkan halaman listing app/blog/page.tsx dengan filter search dan pagination, serta detail app/blog/[slug]/page.tsx menggunakan React Server Components dan Tailwind CSS.", "Prompt Next.js Scaffolder")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Membuat halaman frontend Next.js App Router lengkap dengan fetch data real-time, SEO meta tags, dan Tailwind CSS.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Gunakan MCP sacms tool get_content_type untuk koleksi 'articles'. Buatkan halaman listing app/blog/page.tsx dengan filter search dan pagination, serta detail app/blog/[slug]/page.tsx menggunakan React Server Components dan Tailwind CSS.
                  </pre>
                </Card>

                {/* Recipe 3: Schema Designer (33 Field Types) */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold">
                        Schema Builder
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">3. Desain Content Type (33 Field Types)</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy("Panggil tool list_field_types untuk memeriksa tipe field yang didukung. Kemudian buatkan Content Type baru bernama 'Products' (slug: 'products') dengan field: title (text), slug (slug), description (richText), price (currency: IDR), gallery (mediaMultiple), status (select), dan category (relation ke 'categories').", "Prompt Schema Designer")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Membuat model koleksi data baru langsung dari instruksi bahasa alami di IDE menggunakan 33 tipe field presisi.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Panggil tool list_field_types untuk memeriksa tipe field yang didukung. Kemudian buatkan Content Type baru bernama 'Products' (slug: 'products') dengan field: title (text), slug (slug), description (richText), price (currency: IDR), gallery (mediaMultiple), status (select), dan category (relation ke 'categories').
                  </pre>
                </Card>

                {/* Recipe 4: Batch Data Seeding */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                        Mock Data
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">4. Batch Dummy Data Seeder</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy("Gunakan tool bulk_create_entries untuk memasukkan 10 data dummy realistis ke koleksi 'products' lengkap dengan status PUBLISHED, harga, dan deskripsi berbahasa Indonesia.", "Prompt Batch Seeder")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mengisi database CMS dengan banyak data contoh realistis dalam satu kali panggil untuk mempercepat pengujian UI frontend.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Gunakan tool bulk_create_entries untuk memasukkan 10 data dummy realistis ke koleksi 'products' lengkap dengan status PUBLISHED, harga, dan deskripsi berbahasa Indonesia.
                  </pre>
                </Card>

                {/* Recipe 5: 1-Click Vercel Deploy */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold">
                        Cloud Deploy
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">5. Deploy Frontend Langsung ke Vercel</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy("Deploy seluruh source code project frontend ini ke Vercel hosting menggunakan MCP tool deploy_to_vercel dengan project name 'my-sacms-app'.", "Prompt Vercel Deploy")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Menerbitkan website ke internet dan mengembalikan live URL produksi dalam hitungan detik.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Deploy seluruh source code project frontend ini ke Vercel hosting menggunakan MCP tool deploy_to_vercel dengan project name 'my-sacms-app'.
                  </pre>
                </Card>

                {/* Recipe 6: Headless Member Auth & Login */}
                <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 text-[10px] font-bold">
                        Headless Auth
                      </Badge>
                      <h3 className="text-sm font-bold text-foreground">6. Scaffold Auth Register & Login Client</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCopy(`Buatkan form autentikasi Next.js (app/login/page.tsx & app/register/page.tsx) yang memanggil endpoint Headless Auth SaCMS (/api/public/${tenantSlug}/auth/login dan /register), menyimpan Access Token JWT di cookie/localStorage, dan mengambil profil member dari /api/public/${tenantSlug}/auth/me.`, "Prompt Auth Scaffolder")}
                      className="h-7 px-2 text-xs font-bold text-primary"
                    >
                      <Copy className="h-3 w-3 mr-1" /> Salin Prompt
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Menghasilkan form login & register end-user lengkap dengan JWT access token, refresh token rotation, dan proteksi route.
                  </p>
                  <pre className="p-3 bg-muted/40 rounded-xl border border-border/60 font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    Buatkan form autentikasi Next.js (app/login/page.tsx & app/register/page.tsx) yang memanggil endpoint Headless Auth SaCMS (/api/public/{tenantSlug}/auth/login dan /register), menyimpan Access Token JWT di cookie, dan mengambil profil member dari /api/public/{tenantSlug}/auth/me.
                  </pre>
                </Card>

              </div>
            </TabsContent>

            {/* TAB 3: RECOMMENDED MCP TOOLS */}
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
