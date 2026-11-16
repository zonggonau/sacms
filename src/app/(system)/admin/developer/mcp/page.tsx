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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { copyToClipboard } from "@/lib/clipboard"
import {
  getGlobalSchemaMcpTokenAction,
  createGlobalSchemaMcpTokenAction,
  regenerateGlobalSchemaMcpTokenAction,
  deleteGlobalSchemaMcpTokenAction,
} from "@/actions/mcp-tokens"

export default function AdminDeveloperMcpPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [loading, setLoading] = useState(true)
  const [mcpUrl, setMcpUrl] = useState("")
  const [token, setToken] = useState<{ id: string; name: string } | null>(null)
  const [plainToken, setPlainToken] = useState("")
  const [nameInput, setNameInput] = useState("Developer MCP Client")
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
      const res = await getGlobalSchemaMcpTokenAction()
      if ("token" in res) setToken(res.token ?? null)
      setLoading(false)
    })()
  }, [isAdmin])

  const handleCopy = (text: string, label: string) => {
    copyToClipboard(text)
    toast({ title: `${label} disalin` })
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const res = await createGlobalSchemaMcpTokenAction({ name: nameInput.trim() || "Developer MCP Client" })
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal membuat token" })
        return
      }
      setToken(res.token)
      setPlainToken(res.plainToken)
      toast({ title: "Token dibuat", description: "Simpan nilainya sekarang — tidak akan ditampilkan lagi." })
    } finally {
      setBusy(false)
    }
  }

  const handleRegenerate = async () => {
    if (!token) return
    setBusy(true)
    try {
      const res = await regenerateGlobalSchemaMcpTokenAction(token.id)
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal generate ulang token" })
        return
      }
      setToken(res.token)
      setPlainToken(res.plainToken)
      toast({ title: "Token di-generate ulang", description: "Nilai lama tidak berlaku lagi." })
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!token) return
    if (!(await confirm({ title: "Hapus token ini?", description: "Setiap AI agent yang masih memakai token ini akan langsung putus koneksi.", confirmLabel: "Hapus", variant: "destructive" }))) return
    setBusy(true)
    try {
      const res = await deleteGlobalSchemaMcpTokenAction(token.id)
      if (res.error || !res.success) {
        toast({ variant: "destructive", title: "Gagal", description: res.error || "Gagal menghapus token" })
        return
      }
      setToken(null)
      setPlainToken("")
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
    { mcpServers: { "sacms-developer": { url: mcpUrl, headers: { Authorization: `Bearer ${plainToken || "YOUR_TOKEN"}` } } } },
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
            <span>Hasil template yang dibuat lewat server ini muncul di menu <strong className="text-foreground">Website Template</strong> di sebelah kiri.</span>
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
              <CardDescription className="text-xs">Satu token aktif pada satu waktu — generate ulang untuk mengganti.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {!token ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Nama token"
                    className="h-9 rounded-xl text-xs bg-muted/20 border-border/80 max-w-xs"
                  />
                  <Button onClick={handleCreate} disabled={busy} className="rounded-xl h-9 px-4 text-xs font-bold">
                    {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Key className="h-3.5 w-3.5 mr-1.5" />}
                    Buat Token
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Input
                      value={plainToken || "••••••••••••••••••••••• (nilai lama, tidak ditampilkan lagi)"}
                      readOnly
                      className="font-mono text-xs bg-muted/30 border-border/80 rounded-xl h-9 flex-1"
                    />
                    {plainToken && (
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => { handleCopy(plainToken, "Token"); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                        className="h-9 w-9 rounded-xl shrink-0"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" disabled={busy} onClick={handleRegenerate} className="font-bold rounded-xl h-9 px-3 text-xs shrink-0">
                      Generate Ulang
                    </Button>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={handleDelete} className="font-bold rounded-xl h-9 px-3 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                      Hapus
                    </Button>
                  </div>
                  {!plainToken && (
                    <p className="text-[11px] text-muted-foreground">
                      Token "{token.name}" sudah dibuat, tapi nilai aslinya hanya ditampilkan sekali saat dibuat/generate ulang.
                    </p>
                  )}
                </div>
              )}
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
