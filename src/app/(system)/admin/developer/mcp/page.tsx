"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Server,
  Copy,
  Check,
  Key,
  Loader2,
  Layers,
  Info,
  ShieldCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { copyToClipboard } from "@/lib/clipboard"
import { GLOBAL_MCP_SCOPES, GLOBAL_MCP_SCOPE_LABELS, type GlobalMcpScope } from "@/lib/mcp-global-scopes"
import {
  getGlobalSchemaMcpTokensAction,
  createGlobalSchemaMcpTokenAction,
  regenerateGlobalSchemaMcpTokenAction,
  deleteGlobalSchemaMcpTokenAction,
} from "@/actions/mcp-tokens"

interface GlobalMcpToken {
  id: string
  name: string
  scopes: GlobalMcpScope[]
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

const SCOPE_HINTS: Record<GlobalMcpScope, string> = {
  read: "Melihat template, schema, demo, dan status.",
  demo: "Mengisi konten workspace demo.",
  write: "Membuat dan mengubah template.",
  delete: "Menghapus Website Template, Schema Template, dan Global Component.",
  publish: "Mengajukan publikasi, schema default, dan hapus berantai — tetap menunggu persetujuan di dashboard.",
}

const EXPIRY_OPTIONS = [
  { value: "never", label: "Tidak kedaluwarsa" },
  { value: "30", label: "30 hari" },
  { value: "90", label: "90 hari" },
  { value: "365", label: "1 tahun" },
]

function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"
}

export default function AdminDeveloperMcpPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [mcpUrl, setMcpUrl] = useState("")
  const [tokens, setTokens] = useState<GlobalMcpToken[]>([])
  const [revealed, setRevealed] = useState<{ tokenId: string; value: string } | null>(null)
  const [nameInput, setNameInput] = useState("Developer MCP Client")
  const [scopes, setScopes] = useState<GlobalMcpScope[]>([...GLOBAL_MCP_SCOPES])
  const [expiry, setExpiry] = useState("never")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
    setMcpUrl(`${origin}/api/mcp/global-schema`)
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    ;(async () => {
      const res = await getGlobalSchemaMcpTokensAction()
      if ("tokens" in res && res.tokens) setTokens(res.tokens)
      setLoading(false)
    })()
  }, [isAdmin])

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text)
    toast({ title: `${label} disalin` })
  }

  const toggleScope = (scope: GlobalMcpScope, checked: boolean) => {
    if (scope === "read") return
    setScopes((prev) => (checked ? [...prev, scope] : prev.filter((s) => s !== scope)))
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const res = await createGlobalSchemaMcpTokenAction({
        name: nameInput.trim() || "Developer MCP Client",
        scopes,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      })
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal membuat token" })
        return
      }
      setTokens((prev) => [...prev, res.token])
      setRevealed({ tokenId: res.token.id, value: res.plainToken })
      toast({ title: "Token dibuat", description: "Simpan nilainya sekarang — tidak akan ditampilkan lagi." })
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async (token: GlobalMcpToken) => {
    if (!(await confirm({ title: `Generate ulang "${token.name}"?`, description: "Nilai lama langsung tidak berlaku. Agent yang memakainya harus diperbarui.", confirmLabel: "Generate Ulang" }))) return
    setBusy(true)
    try {
      const res = await regenerateGlobalSchemaMcpTokenAction(token.id)
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal generate ulang token" })
        return
      }
      setTokens((prev) => prev.map((t) => (t.id === token.id ? res.token : t)))
      setRevealed({ tokenId: token.id, value: res.plainToken })
      toast({ title: "Token di-generate ulang", description: "Nilai lama tidak berlaku lagi." })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (token: GlobalMcpToken) => {
    if (!(await confirm({ title: `Hapus "${token.name}"?`, description: "Setiap AI agent yang masih memakai token ini akan langsung putus koneksi.", confirmLabel: "Hapus", variant: "destructive" }))) return
    setBusy(true)
    try {
      const res = await deleteGlobalSchemaMcpTokenAction(token.id)
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal menghapus token" })
        return
      }
      setTokens((prev) => prev.filter((t) => t.id !== token.id))
      if (revealed?.tokenId === token.id) setRevealed(null)
      toast({ title: "Token dihapus" })
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  const sampleConfig = JSON.stringify(
    { mcpServers: { "sacms-developer": { url: mcpUrl, headers: { Authorization: `Bearer ${revealed?.value || "YOUR_TOKEN"}` } } } },
    null, 2,
  )

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-3xl mx-auto space-y-6">

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">MCP Server Developer</h1>
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                Platform
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              Server MCP khusus untuk tim developer SaCMS membangun/mengubah Schema Template &amp; Website Template lewat AI agent — tidak bisa mengakses konten atau workspace tenant manapun.
            </p>
          </div>

          <div className="flex items-start gap-2 p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              Hasil template muncul di menu <strong className="text-foreground">Website Template</strong>. Publikasi, schema default, dan hapus berantai yang diajukan agent menunggu persetujuan di <strong className="text-foreground">Persetujuan MCP</strong>.
            </span>
          </div>

          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" /> URL Server
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-2">
                <Input value={mcpUrl} readOnly className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9" />
                <Button variant="secondary" size="sm" onClick={() => handleCopy(mcpUrl, "URL")} className="h-9 px-3 rounded-xl text-xs font-bold shrink-0">
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" /> Token
              </CardTitle>
              <CardDescription className="text-xs">Buat token terpisah per agent dengan cakupan seperlunya. Nilai token hanya ditampilkan sekali.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {revealed && (
                <div className="space-y-1.5 p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <p className="text-[11px] font-bold text-foreground">Salin token ini sekarang — tidak akan ditampilkan lagi.</p>
                  <div className="flex items-center gap-2">
                    <Input value={revealed.value} readOnly className="font-mono text-xs bg-background border-border/80 rounded-xl h-9 flex-1" />
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={() => { handleCopy(revealed.value, "Token"); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                      className="h-9 w-9 rounded-xl shrink-0"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {tokens.length > 0 && (
                <div className="divide-y divide-border/60 rounded-xl border border-border/80">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-xs font-bold text-foreground truncate">{token.name}</p>
                        <div className="flex flex-wrap gap-1">
                          {token.scopes.map((scope) => (
                            <Badge key={scope} variant="outline" className="text-[9px] font-bold rounded-full">{GLOBAL_MCP_SCOPE_LABELS[scope]}</Badge>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Terakhir dipakai {formatDate(token.lastUsedAt)} · Kedaluwarsa {token.expiresAt ? formatDate(token.expiresAt) : "tidak pernah"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => handleRegenerate(token)} className="font-bold rounded-xl h-8 px-3 text-xs">
                          Generate Ulang
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => handleDelete(token)} className="font-bold rounded-xl h-8 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-xl border border-dashed border-border/80 p-3">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Token baru</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nama token"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 flex-1"
                  />
                  <Select value={expiry} onValueChange={setExpiry}>
                    <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 sm:w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPIRY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GLOBAL_MCP_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-start gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={scopes.includes(scope)}
                        disabled={scope === "read"}
                        onCheckedChange={(checked) => toggleScope(scope, checked === true)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-bold text-foreground">{GLOBAL_MCP_SCOPE_LABELS[scope]}</span>
                        <span className="block text-[11px] text-muted-foreground">{SCOPE_HINTS[scope]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <Button onClick={handleCreate} disabled={busy} className="rounded-xl h-9 px-4 text-xs font-bold">
                  {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Key className="h-3.5 w-3.5 mr-1.5" />}
                  Buat Token
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Konfigurasi Contoh
              </CardTitle>
              <CardDescription className="text-xs">Format umum (mcp.json/settings) untuk client yang menerima koneksi MCP via URL + Bearer token.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <pre className="text-[11px] font-mono bg-muted/30 border border-border/80 rounded-xl p-3 overflow-x-auto">{sampleConfig}</pre>
              <Button variant="outline" size="sm" onClick={() => handleCopy(sampleConfig, "Konfigurasi")} className="h-8 rounded-lg text-[11px] font-bold border-border/80">
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Salin Konfigurasi
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
