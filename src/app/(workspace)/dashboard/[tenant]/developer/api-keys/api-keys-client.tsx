"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Plus, Key, Copy, Trash2, Loader2, ShieldCheck,
  Save, Globe, Shield, Terminal, Settings2, Sliders, CheckCircle,
  ExternalLink, Lock, Code2, AlertTriangle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { createApiTokenAction, deleteApiTokenAction } from "@/actions/api-keys"

interface ApiToken {
  id: string
  tenantId: string
  name: string
  permissions: string[]
  expiresAt: Date | string | null
  lastUsedAt: Date | string | null
  createdAt: Date | string
}

interface ApiSettings {
  tenantId: string
  apiVersion: string
  rateLimiting: boolean
  requestsPerMinute: string
  burstLimit: string
  corsOrigins: string
}

interface LegacyApiKey {
  id: string
  name: string
  createdAt: Date | string
  expiresAt: Date | string | null
}

interface ApiKeysClientProps {
  initialTokens: ApiToken[]
  legacyApiKeys?: LegacyApiKey[]
  tenantSlug: string
  initialSettings: ApiSettings
}

export function ApiKeysClient({ initialTokens, legacyApiKeys = [], tenantSlug, initialSettings }: ApiKeysClientProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [isPending, startTransition] = useTransition()
  
  // API Configuration state
  const [tenantId] = useState(initialSettings.tenantId || tenantSlug)
  const [apiVersion, setApiVersion] = useState(initialSettings.apiVersion || "v1")
  const [rateLimiting, setRateLimiting] = useState(initialSettings.rateLimiting ?? true)
  const [requestsPerMinute, setRequestsPerMinute] = useState(String(initialSettings.requestsPerMinute || "60"))
  const [burstLimit, setBurstLimit] = useState(String(initialSettings.burstLimit || "100"))
  const [corsOrigins, setCorsOrigins] = useState(initialSettings.corsOrigins || "")
  const [savingSettings, setSavingSettings] = useState(false)

  // Token state & dialogs
  const [tokensList, setTokensList] = useState<ApiToken[]>(initialTokens)
  const [legacyKeysList, setLegacyKeysList] = useState<LegacyApiKey[]>(legacyApiKeys)
  const [revokingLegacyId, setRevokingLegacyId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(["read"])
  const [createdPlainToken, setCreatedPlainToken] = useState<string | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = async (text: string, label: string = "Teks", id?: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      if (id) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      }
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

  const handleSaveApiSettings = async () => {
    setSavingSettings(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiVersion,
          rateLimiting,
          requestsPerMinute: parseInt(requestsPerMinute) || 60,
          burstLimit: parseInt(burstLimit) || 100,
          corsOrigins,
        }),
      })

      if (res.ok) {
        toast({
          title: "Berhasil Disimpan",
          description: "Pengaturan API dan rate limiting workspace berhasil diperbarui.",
        })
      } else {
        const data = await res.json()
        toast({
          variant: "destructive",
          title: "Gagal Menyimpan",
          description: data.error || "Terjadi kesalahan saat menyimpan pengaturan",
        })
      }
    } catch (error) {
      console.error("Failed to save API settings:", error)
      toast({
        variant: "destructive",
        title: "Terjadi Kesalahan",
        description: "Gagal menghubungi server",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const handleCreateToken = () => {
    if (!newTokenName.trim() || newTokenPermissions.length === 0) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Masukkan nama token dan pilih minimal satu izin hak akses",
      })
      return
    }

    const hasWriteOrDelete = newTokenPermissions.includes("write") || newTokenPermissions.includes("delete")
    const calculatedType = hasWriteOrDelete ? "full-access" : "read-only"

    startTransition(async () => {
      const res = await createApiTokenAction(tenantSlug, {
        name: newTokenName.trim(),
        type: calculatedType,
        permissions: newTokenPermissions,
      })

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Terjadi Kesalahan",
          description: res.error,
        })
      } else {
        setShowCreateDialog(false)
        setNewTokenName("")
        setNewTokenPermissions(["read"])
        setCreatedPlainToken(res.plainToken || null)
        if (res.token) {
          setTokensList(prev => [res.token as any, ...prev])
        }
        setShowTokenDialog(true)
        toast({
          title: "Berhasil",
          description: "API Key baru berhasil dibuat",
        })
      }
    })
  }

  const handleDeleteToken = async (tokenId: string) => {
    if (
      !(await confirm({
        title: "Hapus API key ini?",
        description: "Aplikasi yang menggunakan token ini akan kehilangan akses.",
        confirmLabel: "Hapus API key",
        variant: "destructive",
      }))
    )
      return

    startTransition(async () => {
      const res = await deleteApiTokenAction(tenantSlug, tokenId)
      if (res.error) {
        toast({
          variant: "destructive",
          title: "Terjadi Kesalahan",
          description: res.error,
        })
      } else {
        setTokensList(prev => prev.filter(t => t.id !== tokenId))
        toast({
          title: "Berhasil",
          description: "API key berhasil dihapus",
        })
      }
    })
  }

  const handleRevokeLegacyKey = async (id: string) => {
    if (
      !(await confirm({
        title: "Cabut kunci legacy ini?",
        description: "Ini adalah kredensial full-access lama (bukan API Token biasa). Aplikasi yang masih memakainya akan langsung kehilangan akses.",
        confirmLabel: "Cabut Kunci",
        variant: "destructive",
      }))
    )
      return

    setRevokingLegacyId(id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/api-keys?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mencabut kunci")
      setLegacyKeysList(prev => prev.filter(k => k.id !== id))
      toast({ title: "Kunci Legacy Dicabut", description: "Kredensial lama telah dinonaktifkan." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mencabut Kunci", description: err.message })
    } finally {
      setRevokingLegacyId(null)
    }
  }

  const formatDate = (dateString: Date | string | null) => {
    if (!dateString) return "Belum Pernah"
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">API Keys & Konfigurasi API</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                  Content API
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola kredensial autentikasi API, rate limiting, dan CORS origins untuk integrasi aplikasi frontend.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl text-xs font-bold border-border/80"
                asChild
              >
                <a href={`/dashboard/${tenantSlug}/developer/api`}>
                  <Terminal className="h-3.5 w-3.5 mr-1.5" />
                  REST Explorer
                </a>
              </Button>

              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat API Key Baru
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold text-foreground">Buat API Key Baru</DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                      Generate token otorisasi untuk mengakses Content REST dan GraphQL API.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="key-name" className="text-xs font-semibold text-foreground">Nama Kunci (Key Name)</Label>
                      <Input
                        id="key-name"
                        placeholder="Contoh: Next.js Frontend Production"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-background border-border/80"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-foreground">Izin Hak Akses</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "read", label: "Read (Baca)", desc: "GET" },
                          { id: "write", label: "Write (Tulis)", desc: "POST / PUT" },
                          { id: "delete", label: "Delete (Hapus)", desc: "DELETE" }
                        ].map((perm) => (
                          <div 
                            key={perm.id} 
                            className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 cursor-pointer"
                            onClick={() => {
                              if (newTokenPermissions.includes(perm.id)) {
                                if (newTokenPermissions.length > 1) {
                                  setNewTokenPermissions(newTokenPermissions.filter(p => p !== perm.id))
                                }
                              } else {
                                setNewTokenPermissions([...newTokenPermissions, perm.id])
                              }
                            }}
                          >
                            <Checkbox
                              id={perm.id}
                              checked={newTokenPermissions.includes(perm.id)}
                              className="pointer-events-none"
                            />
                            <div className="text-xs">
                              <p className="font-bold text-foreground">{perm.label}</p>
                              <p className="text-[10px] text-muted-foreground">{perm.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0 pt-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isPending} className="rounded-xl text-xs font-bold h-9">
                      Batal
                    </Button>
                    <Button onClick={handleCreateToken} disabled={isPending} className="rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground">
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                      {isPending ? "Membuat..." : "Simpan Key"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Quick Endpoint Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Workspace Slug / ID</p>
                <p className="font-mono font-bold text-xs text-foreground">{tenantSlug}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => handleCopy(tenantSlug, "Workspace ID")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Content REST API Base</p>
                <p className="font-mono text-xs text-foreground truncate max-w-[200px]">/api/public/{tenantSlug}/content</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => handleCopy(`/api/public/${tenantSlug}/content`, "API Base Path")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </Card>

            <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Format Header Autentikasi</p>
                <p className="font-mono text-xs text-foreground">Authorization: Bearer &lt;KEY&gt;</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={() => handleCopy(`Authorization: Bearer <YOUR_API_KEY>`, "Header Syntax")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </Card>
          </div>

          {/* Legacy full-access credential warning — surfaces the older
              singleton ApiKey model so it's no longer an invisible,
              unrevokable-from-here live credential. */}
          {legacyKeysList.length > 0 && (
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-xs">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Kredensial Legacy Full-Access Terdeteksi
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Ini adalah kunci API dari sistem lama — selalu <strong>full-access</strong> (tidak bisa dibatasi read-only) dan terpisah dari daftar API Keys di atas. Disarankan untuk mencabutnya dan bermigrasi ke API Key baru.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="space-y-2">
                  {legacyKeysList.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-3 bg-card rounded-xl border border-border/60">
                      <div className="flex items-center gap-2.5">
                        <Key className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-foreground">{key.name}</p>
                          <p className="text-[10px] text-muted-foreground">Dibuat {formatDate(key.createdAt)} · Full-Access</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeLegacyKey(key.id)}
                        disabled={revokingLegacyId === key.id}
                        className="h-7 text-xs font-bold text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        {revokingLegacyId === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                        Cabut
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Layout Tabs */}
          <Tabs defaultValue="keys" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-2 max-w-md h-auto gap-1">
              <TabsTrigger value="keys" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
                <Key className="h-3.5 w-3.5 mr-1.5" />
                Daftar API Keys ({tokensList.length})
              </TabsTrigger>
              <TabsTrigger value="config" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
                <Sliders className="h-3.5 w-3.5 mr-1.5" />
                Konfigurasi REST & CORS
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: API KEYS TABLE */}
            <TabsContent value="keys" className="space-y-6">
              <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Key className="h-4 w-4 text-primary" />
                      Daftar Kunci API (API Keys)
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Gunakan kunci di bawah ini pada header HTTP <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">Authorization: Bearer &lt;KEY&gt;</code> untuk memanggil REST dan GraphQL API.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {tokensList.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="font-bold text-xs text-foreground">Belum ada API Key</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Gunakan tombol <strong>Buat API Key Baru</strong> di pojok kanan atas untuk generate token integrasi.
                      </p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/30 border-b border-border/60">
                        <TableRow>
                          <TableHead className="font-bold text-xs pl-6">Nama Kunci</TableHead>
                          <TableHead className="font-bold text-xs">Token</TableHead>
                          <TableHead className="font-bold text-xs">Hak Akses</TableHead>
                          <TableHead className="font-bold text-xs">Dibuat</TableHead>
                          <TableHead className="font-bold text-xs">Terakhir Dipakai</TableHead>
                          <TableHead className="text-right pr-6 font-bold text-xs">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tokensList.map((apiKey) => (
                          <TableRow key={apiKey.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                            <TableCell className="pl-6 py-3">
                              <div className="flex items-center gap-2">
                                <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                                <span className="text-xs font-bold text-foreground">{apiKey.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <span
                                className="text-xs bg-muted/60 font-mono px-2 py-0.5 rounded-lg border border-border/60 text-muted-foreground tracking-widest"
                                title="Untuk keamanan, token asli hanya ditampilkan sekali saat dibuat dan tidak dapat diambil kembali."
                              >
                                ••••••••••••••••
                              </span>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="flex gap-1 flex-wrap">
                                {Array.isArray(apiKey.permissions) && apiKey.permissions.map((perm) => (
                                  <Badge key={perm} variant="outline" className="text-[10px] font-bold uppercase rounded-md bg-muted/30">
                                    {perm}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-3">
                              {formatDate(apiKey.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground py-3">
                              {formatDate(apiKey.lastUsedAt)}
                            </TableCell>
                            <TableCell className="text-right pr-6 py-3">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteToken(apiKey.id)}
                                className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                                disabled={isPending}
                                title="Hapus Kunci API"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: REST CONFIGURATION & CORS */}
            <TabsContent value="config" className="space-y-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-primary" />
                      Konfigurasi REST API & Keamanan
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Atur versi API, pembatasan kuota request per menit (Rate Limiting), dan domain CORS yang diizinkan.
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleSaveApiSettings} 
                    disabled={savingSettings}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs shrink-0"
                  >
                    {savingSettings ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Simpan Konfigurasi
                  </Button>
                </CardHeader>
                <CardContent className="p-5 space-y-6">
                  
                  {/* API Version */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground">API Version</Label>
                    <Select value={apiVersion} onValueChange={setApiVersion}>
                      <SelectTrigger className="w-56 h-9 rounded-xl text-xs bg-background border-border/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="v1" className="text-xs">v1 (Stable / Rekomendasi)</SelectItem>
                        <SelectItem value="v2" className="text-xs">v2 (Beta Preview)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Versi default yang digunakan untuk merespons permintaan REST API.
                    </p>
                  </div>

                  <Separator />

                  {/* Rate Limiting */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-semibold text-foreground">Rate Limiting Terintegrasi</Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Batasi jumlah request per menit untuk mencegah abuse dan DDoS pada API publik.
                        </p>
                      </div>
                      <Switch checked={rateLimiting} onCheckedChange={setRateLimiting} />
                    </div>

                    {rateLimiting && (
                      <div className="grid gap-4 sm:grid-cols-2 pt-1">
                        <div className="space-y-1.5">
                          <Label htmlFor="rpm" className="text-xs font-semibold text-foreground">Requests Per Menit (RPM)</Label>
                          <Input
                            id="rpm"
                            type="number"
                            value={requestsPerMinute}
                            onChange={(e) => setRequestsPerMinute(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="burst" className="text-xs font-semibold text-foreground">Burst Limit</Label>
                          <Input
                            id="burst"
                            type="number"
                            value={burstLimit}
                            onChange={(e) => setBurstLimit(e.target.value)}
                            className="rounded-xl h-9 text-xs bg-background border-border/80"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Allowed Origins CORS */}
                  <div className="space-y-2">
                    <Label htmlFor="cors" className="text-xs font-semibold text-foreground">Allowed Origins (CORS)</Label>
                    <Textarea
                      id="cors"
                      placeholder="Masukkan daftar origin domain, satu per baris&#10;https://example.com&#10;https://app.example.com"
                      rows={4}
                      value={corsOrigins}
                      onChange={(e) => setCorsOrigins(e.target.value)}
                      className="rounded-xl text-xs font-mono bg-background border-border/80 p-3"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Masukkan satu URL domain per baris. Gunakan <code className="bg-muted px-1 py-0.5 rounded font-mono">*</code> untuk mengizinkan semua origin.
                    </p>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button 
                      onClick={handleSaveApiSettings} 
                      disabled={savingSettings}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs"
                    >
                      {savingSettings ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                      Simpan Konfigurasi
                    </Button>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

          {/* Token Created Success Dialog */}
          <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
            <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
              <DialogHeader>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <DialogTitle className="text-base font-bold text-foreground">API Key Berhasil Dibuat</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pastikan Anda menyalin API key ini sekarang. Demi keamanan, token utuh ini hanya ditampilkan sekali saat dibuat!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Kunci API Anda</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={createdPlainToken || ""}
                      readOnly
                      className="font-mono text-xs bg-muted/40 pr-10 border-primary/30 rounded-xl h-9"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => createdPlainToken && handleCopy(createdPlainToken, "API Key")}
                      className="gap-1.5 whitespace-nowrap h-9 text-xs font-bold rounded-xl"
                    >
                      Salin Key
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                  ✓ Pasang key ini di berkas <code className="font-mono font-bold">.env.local</code> aplikasi Anda sebagai <code className="font-mono font-bold">SACMS_API_KEY</code>.
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setShowTokenDialog(false)} className="w-full rounded-xl text-xs font-bold h-9">
                  Selesai & Tutup
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      </div>
    </div>
  )
}
