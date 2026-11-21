"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Boxes, Search, RefreshCw, Trash2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface GlobalComponentItem {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  category: string | null
  fields: Array<{ name: string; slug: string; type: string }>
  published: boolean
  createdAt: string
}

export default function AdminDeveloperSchemaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [components, setComponents] = useState<GlobalComponentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [toDelete, setToDelete] = useState<GlobalComponentItem | null>(null)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchComponents = async () => {
    try {
      const res = await fetch("/api/admin/global-components")
      if (res.ok) {
        const data = await res.json()
        setComponents(data.components || [])
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat daftar Global Component" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchComponents()
  }, [isAdmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return components
    return components.filter((c) => c.name.toLowerCase().includes(q) || (c.category || "").toLowerCase().includes(q))
  }, [components, search])

  const draftCount = components.filter((c) => !c.published).length

  const handleTogglePublish = async (c: GlobalComponentItem) => {
    setTogglingId(c.id)
    try {
      const res = await fetch(`/api/admin/global-components/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !c.published }),
      })
      if (res.ok) {
        setComponents((prev) => prev.map((x) => (x.id === c.id ? { ...x, published: !c.published } : x)))
        toast({ title: c.published ? "Component di-unpublish" : "Component dipublikasikan" })
      } else {
        const err = await res.json().catch(() => ({}))
        toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal mengubah status" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const res = await fetch(`/api/admin/global-components/${toDelete.id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Berhasil", description: "Global Component dihapus." })
      setComponents((prev) => prev.filter((c) => c.id !== toDelete.id))
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal menghapus component" })
    }
    setToDelete(null)
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

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Global Component</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  {components.length} Component
                </Badge>
                {draftCount > 0 && (
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 rounded-full">
                    {draftCount} Draft
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Katalog field-definition yang bisa dipakai ulang oleh semua workspace, dibangun lewat MCP Server Developer (Global). Publish agar bisa ditemukan workspace lewat list_global_components/get_global_component, dan otomatis dimaterialisasi ke workspace BARU.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRefreshing(true); fetchComponents() }}
              disabled={refreshing}
              className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Muat Ulang
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari nama atau kategori..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-muted/20 border-border/80"
            />
          </div>

          {filtered.length === 0 ? (
            <Card className="rounded-2xl border border-border/80 p-12 text-center text-muted-foreground">
              <Boxes className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs font-semibold">
                {components.length === 0 ? "Belum ada Global Component — buat lewat MCP Server Developer (Global)" : "Tidak ada component yang cocok"}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <Card key={c.id} className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{c.icon}</span>
                        <CardTitle className="text-sm font-bold truncate">{c.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setToDelete(c)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[2.2em]">{c.description || "Tidak ada deskripsi."}</p>
                    <div className="flex flex-wrap gap-1">
                      {c.fields.slice(0, 5).map((f) => (
                        <Badge key={f.slug} variant="outline" className="text-[9px] font-semibold rounded-full">{f.name}</Badge>
                      ))}
                      {c.fields.length > 5 && (
                        <Badge variant="outline" className="text-[9px] font-semibold rounded-full">+{c.fields.length - 5}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={c.published}
                          disabled={togglingId === c.id}
                          onCheckedChange={() => handleTogglePublish(c)}
                        />
                        <span className="text-[11px] font-bold text-muted-foreground">{c.published ? "Published" : "Draft"}</span>
                      </div>
                      {c.category && (
                        <Badge variant="outline" className="text-[9px] font-bold rounded-full">{c.category}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Hapus Global Component?"
        description={`"${toDelete?.name}" akan dihapus permanen dari katalog. Component yang sudah dimaterialisasi sebelumnya di workspace manapun tidak terpengaruh.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
