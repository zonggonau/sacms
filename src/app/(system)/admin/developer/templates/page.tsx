"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  LayoutTemplate,
  Search,
  RefreshCw,
  Trash2,
  ExternalLink,
  Loader2,
  Layers,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getWebsitePreviewUrl, gradientFor } from "@/lib/website-preview"

interface WebsiteTemplateItem {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  published: boolean
  demoUrl: string | null
  createdAt: string
  deployedCount: number
  price: number | null
  soldCount: number
  schemaTemplate: { id: string; name: string; slug: string; icon: string }
}

export default function AdminDeveloperTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [templates, setTemplates] = useState<WebsiteTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [savingPriceId, setSavingPriceId] = useState<string | null>(null)
  const [templateToDelete, setTemplateToDelete] = useState<WebsiteTemplateItem | null>(null)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/website-templates")
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.templates || [])
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat daftar Website Template" })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchTemplates()
  }, [isAdmin])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => t.name.toLowerCase().includes(q) || t.schemaTemplate?.name.toLowerCase().includes(q))
  }, [templates, search])

  // Empty clears the price: the template is free. Saved on blur or Enter.
  const handleSavePrice = async (t: WebsiteTemplateItem) => {
    const draft = priceDrafts[t.id]
    if (draft === undefined) return
    const digits = draft.replace(/[^0-9]/g, "")
    const price = digits ? Number(digits) : null
    if (price === t.price) return
    if (price !== null && price < 1000) {
      toast({ variant: "destructive", title: "Harga tidak valid", description: "Harga minimal Rp 1.000, atau kosongkan agar gratis." })
      return
    }
    setSavingPriceId(t.id)
    try {
      const res = await fetch(`/api/admin/website-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ variant: "destructive", title: "Gagal", description: err.error?.message || err.error || "Gagal menyimpan harga" })
        return
      }
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, price } : x)))
      setPriceDrafts((prev) => { const next = { ...prev }; delete next[t.id]; return next })
      toast({ title: price ? `Harga disimpan: Rp ${price.toLocaleString("id-ID")}` : "Template gratis (harga dikosongkan)" })
    } finally {
      setSavingPriceId(null)
    }
  }

  const handleTogglePublish = async (t: WebsiteTemplateItem) => {
    setTogglingId(t.id)
    try {
      const res = await fetch(`/api/admin/website-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !t.published }),
      })
      if (res.ok) {
        setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, published: !t.published } : x)))
        toast({ title: t.published ? "Template di-unpublish" : "Template dipublikasikan" })
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
    if (!templateToDelete) return
    const res = await fetch(`/api/admin/website-templates/${templateToDelete.id}`, { method: "DELETE" })
    if (res.ok) {
      toast({ title: "Berhasil", description: "Website Template dihapus." })
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id))
    } else {
      const err = await res.json().catch(() => ({}))
      toast({ variant: "destructive", title: "Gagal", description: err.error || "Gagal menghapus template" })
    }
    setTemplateToDelete(null)
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
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Website Template</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  {templates.length} Template
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Katalog frontend siap pakai, dibangun lewat MCP Server Developer. Tenant memakainya lewat tab Website Template di dashboard masing-masing.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setRefreshing(true); fetchTemplates() }}
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
              placeholder="Cari nama template atau schema..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl text-xs bg-muted/20 border-border/80"
            />
          </div>

          {filtered.length === 0 ? (
            <Card className="rounded-2xl border border-border/80 p-12 text-center text-muted-foreground">
              <LayoutTemplate className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-xs font-semibold">
                {templates.length === 0 ? "Belum ada Website Template — buat lewat MCP Server Developer" : "Tidak ada template yang cocok"}
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <Card key={t.id} className="rounded-2xl border border-border/80 shadow-xs overflow-hidden">
                  {/* A real <iframe> here would render blank — every
                      deployed template's own frame-ancestors/X-Frame-Options
                      header blocks third-party framing, even though the
                      same URL opens fine in its own tab. A screenshot <img>
                      isn't subject to that (it only restricts framing, not
                      a plain resource fetch); the gradient+icon tile stays
                      underneath as the loading/error/no-demo fallback. */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border/60">
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(t.id)} bg-muted/30`} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl drop-shadow-sm" aria-hidden>{t.icon}</span>
                    </div>
                    {t.demoUrl && (
                      <img
                        src={getWebsitePreviewUrl(t.demoUrl)}
                        alt={`Pratinjau ${t.name}`}
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-top bg-white"
                        onError={(e) => { e.currentTarget.style.display = "none" }}
                      />
                    )}
                  </div>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xl shrink-0">{t.icon}</span>
                        <CardTitle className="text-sm font-bold truncate">{t.name}</CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setTemplateToDelete(t)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1 space-y-3">
                    <p className="text-[11px] text-muted-foreground line-clamp-2 min-h-[2.2em]">{t.description || "Tidak ada deskripsi."}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Layers className="h-3 w-3" />
                      <span className="truncate">{t.schemaTemplate?.icon} {t.schemaTemplate?.name}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={t.published}
                          disabled={togglingId === t.id}
                          onCheckedChange={() => handleTogglePublish(t)}
                        />
                        <span className="text-[11px] font-bold text-muted-foreground">{t.published ? "Published" : "Draft"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[9px] font-bold rounded-full">{t.deployedCount} dipakai</Badge>
                        <Badge variant="outline" className="text-[9px] font-bold rounded-full">{t.soldCount} terjual</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`price-${t.id}`} className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Harga untuk Starter &amp; Pro (Rp)
                      </label>
                      <Input
                        id={`price-${t.id}`}
                        inputMode="numeric"
                        placeholder="Kosong = gratis"
                        disabled={savingPriceId === t.id}
                        value={priceDrafts[t.id] ?? (t.price ? t.price.toLocaleString("id-ID") : "")}
                        onChange={(e) => setPriceDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                        onBlur={() => handleSavePrice(t)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur() }}
                        className="h-8 rounded-lg text-xs"
                      />
                      <p className="text-[10px] text-muted-foreground">Business selalu gratis. Plan lain tidak bisa memakai template.</p>
                    </div>
                    {t.demoUrl && (
                      <a href={t.demoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline">
                        Lihat Demo <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!templateToDelete}
        onOpenChange={(open) => !open && setTemplateToDelete(null)}
        title="Hapus Website Template?"
        description={`"${templateToDelete?.name}" akan dihapus permanen beserta demo website-nya di Vercel, dan schema yang menjadi dasarnya (jika tidak dipakai Website Template lain). Workspace yang sudah menerapkan template/schema ini sebelumnya tidak terpengaruh.`}
        confirmLabel="Hapus"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
