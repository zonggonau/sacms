"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Bot, Key, Copy, Check, AlertTriangle, Layers, RotateCw, Trash2, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  getOwnerMcpTokenAction,
  createOwnerMcpTokenAction,
  regenerateOwnerMcpTokenAction,
  deleteOwnerMcpTokenAction,
} from "@/actions/owner-mcp-token"

interface OwnerToken {
  id: string
  name: string
  description: string | null
  createdAt: string
  lastUsedAt: string | null
}

const TOOLS = [
  { name: "list_workspaces", desc: "Daftar semua workspace yang dimiliki/dikelola akun ini." },
  { name: "create_workspace", desc: "Buat workspace baru langsung dari sini." },
  { name: "get_workspace", desc: "Info dasar + statistik satu workspace." },
  { name: "cms_get_full_schema", desc: "Ambil seluruh schema CMS satu workspace." },
  { name: "cms_list_content_types", desc: "Daftar Content Type satu workspace." },
  { name: "cms_query_content", desc: "Ambil entri konten dari satu workspace." },
  { name: "cms_create_content_entry", desc: "Tambah entri konten ke satu workspace." },
  { name: "deploy_workspace_frontend", desc: "Deploy frontend langsung ke hosting satu workspace." },
  { name: "get_workspace_openapi_spec", desc: "Ambil dokumen OpenAPI satu workspace." },
]

export function OwnerMcpClient({ activeToken }: { activeToken: OwnerToken | null }) {
  const { toast } = useToast()
  const [token, setToken] = useState(activeToken)
  const [plainToken, setPlainToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [mcpUrl, setMcpUrl] = useState("")

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
    setMcpUrl(`${origin}/api/mcp/owner`)
  }, [])

  async function handleCreate() {
    setBusy(true)
    try {
      const result = await createOwnerMcpTokenAction({ name: "Owner MCP Token" })
      if ("error" in result) {
        toast({ variant: "destructive", title: "Gagal", description: result.error })
        return
      }
      setToken(result.token)
      setPlainToken(result.plainToken)
      toast({ title: "Token dibuat", description: "Salin sekarang — nilai aslinya tidak akan ditampilkan lagi." })
    } finally {
      setBusy(false)
    }
  }

  async function handleRegenerate() {
    if (!token) return
    setBusy(true)
    try {
      const result = await regenerateOwnerMcpTokenAction(token.id)
      if ("error" in result) {
        toast({ variant: "destructive", title: "Gagal", description: result.error })
        return
      }
      setToken(result.token)
      setPlainToken(result.plainToken)
      toast({ title: "Token di-generate ulang", description: "Token lama tidak berlaku lagi — update konfigurasi client Anda." })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    setBusy(true)
    try {
      const result = await deleteOwnerMcpTokenAction(token.id)
      if ("error" in result) {
        toast({ variant: "destructive", title: "Gagal", description: result.error })
        return
      }
      setToken(null)
      setPlainToken(null)
      toast({ title: "Token dihapus" })
    } finally {
      setBusy(false)
      setConfirmDeleteOpen(false)
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Disalin!", description: `${label} berhasil disalin.` })
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin" })
    }
  }

  const effectiveToken = plainToken || "YOUR_OWNER_TOKEN"
  const configSnippet = JSON.stringify(
    { mcpServers: { "sacms-owner": { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${effectiveToken}` } } } },
    null,
    2,
  )
  const urlWithToken = plainToken ? `${mcpUrl}?token=${plainToken}` : null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">MCP Server — Owner</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Satu koneksi untuk mengelola SEMUA workspace akun ini — buat workspace baru, baca schema, kelola konten, dan deploy frontend tanpa harus memasukkan token MCP per-workspace satu per satu.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
            <p className="font-bold">Token ini jauh lebih berkuasa dari token MCP biasa.</p>
            <p>
              Token MCP di dalam satu workspace cuma bisa akses workspace itu saja. Token Owner ini bisa membuat workspace baru dan membaca/mengubah SEMUA workspace yang Anda miliki atau kelola sebagai admin. Simpan dengan sangat hati-hati, dan hapus/generate ulang kalau dicurigai bocor.
            </p>
            <p>
              Tim developer yang hanya butuh mengelola satu workspace tetap sebaiknya pakai token MCP per-workspace biasa (di halaman Developer &gt; MCP masing-masing workspace) — bukan token ini.
            </p>
          </div>
        </div>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" /> Token Owner
          </CardTitle>
          <CardDescription className="text-xs">Satu token per akun — generate ulang untuk rotasi, bukan membuat yang baru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!token ? (
            <Button onClick={handleCreate} disabled={busy} className="rounded-xl font-bold text-xs h-9">
              <Key className="h-3.5 w-3.5 mr-1.5" /> Buat Token Owner
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-bold">{token.name}</Badge>
                <span className="text-[11px] text-muted-foreground">
                  {token.lastUsedAt ? `Terakhir dipakai ${new Date(token.lastUsedAt).toLocaleString("id-ID")}` : "Belum pernah dipakai"}
                </span>
              </div>

              {plainToken ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Nilai Token (hanya tampil sekali)</Label>
                  <div className="flex gap-2">
                    <Input value={plainToken} readOnly className="font-mono text-xs bg-muted/30 h-9 rounded-xl" />
                    <Button size="sm" variant="secondary" onClick={() => copy(plainToken, "Token")} className="h-9 rounded-xl shrink-0">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                  <Info className="h-3 w-3 shrink-0 mt-0.5" />
                  Nilai asli token hanya ditampilkan sekali saat dibuat/di-generate ulang. Generate ulang kalau Anda butuh salinan baru.
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={busy} className="h-8 rounded-xl text-xs font-bold">
                  <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Generate Ulang
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteOpen(true)} disabled={busy} className="h-8 rounded-xl text-xs font-bold text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Hapus
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Hapus token Owner ini?"
        description="Agent/client apa pun yang masih memakai token ini akan langsung kehilangan akses ke semua workspace Anda lewat koneksi ini."
        confirmLabel="Hapus"
        onConfirm={handleDelete}
      />

      {token && (
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Setup (format universal — JSON mcpServers)</CardTitle>
            <CardDescription className="text-xs">
              Cocok untuk client apa pun yang menerima konfigurasi JSON MCP (Claude Desktop/Code, Cursor, VS Code, Emergent, dll). Untuk client berbasis URL polos, gunakan Server URL di bawah lalu isi token lewat kolom Authorization/Bearer terpisah.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {urlWithToken && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  Server URL + Token (siap pakai, sekali salin)
                  <Badge variant="outline" className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20">Rekomendasi</Badge>
                </Label>
                <div className="flex gap-2">
                  <Input value={urlWithToken} readOnly className="font-mono text-xs bg-muted/30 h-9 rounded-xl" />
                  <Button size="sm" variant="secondary" onClick={() => copy(urlWithToken, "Server URL + Token")} className="h-9 rounded-xl shrink-0">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Token sudah tertanam di URL ini — tempel langsung ke client yang hanya minta satu Server URL, tanpa isi field Authorization terpisah.
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Server URL</Label>
              <div className="flex gap-2">
                <Input value={mcpUrl} readOnly className="font-mono text-xs bg-muted/30 h-9 rounded-xl" />
                <Button size="sm" variant="secondary" onClick={() => copy(mcpUrl, "Server URL")} className="h-9 rounded-xl shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold">Konfigurasi JSON</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(configSnippet, "Konfigurasi")} className="h-6 px-2 text-xs font-bold text-primary">
                  <Copy className="h-3 w-3 mr-1" /> Salin
                </Button>
              </div>
              <pre className="p-3 bg-muted/40 rounded-xl border border-border/80 font-mono text-xs text-foreground overflow-x-auto">{configSnippet}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> {TOOLS.length} Tools Owner
          </CardTitle>
          <CardDescription className="text-xs">
            Set tool yang sengaja lebih kecil dari server MCP per-workspace (37 tools) — list/buat workspace, baca schema, kelola konten, dan deploy. Untuk kontrol penuh satu workspace (ubah schema, webhook, domain), pakai token MCP workspace itu sendiri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {TOOLS.map((t) => (
              <div key={t.name} className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1">
                <code className="text-xs font-bold text-primary font-mono">{t.name}</code>
                <p className="text-[11px] text-muted-foreground">{t.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
