"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Plus, Key, Copy, Trash2, Loader2, ShieldCheck, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createApiTokenAction, deleteApiTokenAction } from "@/actions/api-keys"

interface ApiToken {
  id: string
  tenantId: string
  name: string
  token: string
  permissions: string[]
  expiresAt: Date | string | null
  lastUsedAt: Date | string | null
  createdAt: Date | string
}

interface ApiKeysClientProps {
  initialTokens: ApiToken[]
  tenantSlug: string
}

export function ApiKeysClient({ initialTokens, tenantSlug }: ApiKeysClientProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newTokenName, setNewTokenName] = useState("")
  const [newTokenPermissions, setNewTokenPermissions] = useState<string[]>(["read"])
  const [createdPlainToken, setCreatedPlainToken] = useState<string | null>(null)
  const [showTokenDialog, setShowTokenDialog] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyKey = async (token: string, label: string = "API key", id?: string) => {
    if (!token) return
    try {
      await navigator.clipboard.writeText(token)
      if (id) {
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
      }
      toast({
        title: "Disalin!",
        description: `${label} berhasil disalin ke clipboard`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Gagal menyalin ${label.toLowerCase()}`,
      })
    }
  }

  const handleCreateKey = () => {
    if (!newTokenName || newTokenPermissions.length === 0) {
      toast({
        variant: "destructive",
        title: "Validasi Gagal",
        description: "Masukkan nama token dan minimal satu izin hak akses",
      })
      return
    }

    startTransition(async () => {
      const res = await createApiTokenAction(tenantSlug, {
        name: newTokenName,
        type: "read-only",
        permissions: newTokenPermissions,
      })

      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
        })
      } else {
        setShowCreateDialog(false)
        setNewTokenName("")
        setNewTokenPermissions(["read"])
        setCreatedPlainToken(res.plainToken || null)
        setShowTokenDialog(true)
        toast({
          title: "Berhasil",
          description: "API Key berhasil dibuat",
        })
      }
    })
  }

  const handleDeleteKey = (tokenId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus API key ini? Token yang dihapus tidak dapat digunakan lagi.")) return

    startTransition(async () => {
      const res = await deleteApiTokenAction(tenantSlug, tokenId)
      if (res.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: res.error,
        })
      } else {
        toast({
          title: "Berhasil",
          description: "API key berhasil dihapus",
        })
      }
    })
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
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">API Keys & Tokens</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Kelola kredensial autentikasi API untuk integrasi aplikasi eksternal dan frontend.
              </p>
            </div>
            
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat API Key
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-foreground">Buat API Key Baru</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Generate token baru untuk otorisasi akses ke Content REST/GraphQL API.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="key-name" className="text-xs font-semibold text-foreground">Nama Token</Label>
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
                        { id: "write", label: "Write (Tulis)", desc: "POST/PUT" },
                        { id: "delete", label: "Delete (Hapus)", desc: "DELETE" }
                      ].map((perm) => (
                        <div 
                          key={perm.id} 
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-border/80 bg-muted/20 hover:bg-muted/40 cursor-pointer"
                          onClick={() => {
                            if (newTokenPermissions.includes(perm.id)) {
                              setNewTokenPermissions(newTokenPermissions.filter(p => p !== perm.id))
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
                  <Button onClick={handleCreateKey} disabled={isPending} className="rounded-xl text-xs font-bold h-9 bg-primary text-primary-foreground">
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {isPending ? "Membuat..." : "Simpan Key"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Info Banner */}
          <div className="p-4 bg-muted/30 border border-border/80 rounded-2xl flex items-center gap-3 text-xs text-muted-foreground shadow-xs">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
              <Key className="h-4 w-4" />
            </div>
            <p className="leading-relaxed">
              Gunakan API key di header HTTP: <code className="bg-muted px-1.5 py-0.5 rounded-md font-mono text-[11px] text-foreground font-bold">Authorization: Bearer &lt;TOKEN&gt;</code> untuk mengakses endpoint konten secara aman.
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Total API Keys</p>
                <div className="text-2xl font-black text-foreground">{initialTokens.length}</div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Izin Baca (Read)</p>
                <div className="text-2xl font-black text-foreground">
                  {initialTokens.filter((k) => k.permissions.includes("read")).length}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Izin Tulis (Write)</p>
                <div className="text-2xl font-black text-foreground">
                  {initialTokens.filter((k) => k.permissions.includes("write")).length}
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Izin Hapus (Delete)</p>
                <div className="text-2xl font-black text-foreground">
                  {initialTokens.filter((k) => k.permissions.includes("delete")).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* API Keys Table */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-4 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">Daftar API Key Workspace</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Jaga kerahasiaan API Key Anda. Jangan simpan key pada repository publik.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {initialTokens.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="font-bold text-xs text-foreground">Belum ada API Key</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Buat API key pertama Anda untuk menghubungkan CMS dengan aplikasi Anda.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30 border-b border-border/60">
                    <TableRow>
                      <TableHead className="font-bold text-xs pl-6">Nama Key</TableHead>
                      <TableHead className="font-bold text-xs">Token Snippet</TableHead>
                      <TableHead className="font-bold text-xs">Hak Akses</TableHead>
                      <TableHead className="font-bold text-xs">Dibuat</TableHead>
                      <TableHead className="font-bold text-xs">Terakhir Dipakai</TableHead>
                      <TableHead className="text-right pr-6 font-bold text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialTokens.map((apiKey) => (
                      <TableRow key={apiKey.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                        <TableCell className="pl-6 py-3">
                          <div className="flex items-center gap-2">
                            <Key className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-bold text-foreground">{apiKey.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs bg-muted/60 font-mono px-2 py-0.5 rounded-lg border border-border/60 text-foreground">
                              {(apiKey.token || "").substring(0, 15)}...
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                              onClick={() => handleCopyKey(apiKey.token || "", "API key", apiKey.id)}
                            >
                              {copiedId === apiKey.id ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex gap-1">
                            {apiKey.permissions.map((perm) => (
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
                            onClick={() => handleDeleteKey(apiKey.id)}
                            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                            disabled={isPending}
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
        </div>

        {/* Created Token Display Dialog */}
        <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl border-border/80 bg-card">
            <DialogHeader>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base font-bold text-foreground">API Key Berhasil Dibuat</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pastikan Anda menyalin API key ini sekarang. Demi keamanan, token ini tidak akan ditampilkan kembali secara utuh!
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 py-3">
              <div className="grid flex-1 gap-2">
                <Label htmlFor="token" className="sr-only">
                  API Key
                </Label>
                <Input
                  id="token"
                  defaultValue={createdPlainToken || ""}
                  readOnly
                  className="font-mono text-xs h-9 rounded-xl bg-muted/30 border-border/80"
                />
              </div>
              <Button
                type="button"
                className="h-9 px-3 rounded-xl bg-primary text-primary-foreground font-bold text-xs"
                onClick={() => handleCopyKey(createdPlainToken || "", "API key")}
              >
                <Copy className="h-3.5 w-3.5 mr-1" /> Salin
              </Button>
            </div>
            <DialogFooter className="sm:justify-start">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs font-bold h-9"
                onClick={() => setShowTokenDialog(false)}
              >
                Selesai
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  )
}
