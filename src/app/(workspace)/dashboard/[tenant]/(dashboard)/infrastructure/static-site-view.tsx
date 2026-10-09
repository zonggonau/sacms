"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Zap, Loader2, ExternalLink, Cpu, Sparkles, Eye, UploadCloud, History, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { ROOT_DOMAIN } from "@/lib/portal-urls"
import { SCHEMA_MODEL_OPTIONS } from "../../developer/aischema/schema-step"

interface StaticSite {
  id: string
  prompt: string | null
  published: boolean
  html: string
  draftHtml: string | null
  draftPrompt: string | null
  draftAt: string | null
  updatedAt: string
}

interface SiteVersion {
  id: string
  prompt: string | null
  publishedAt: string
}

interface StaticSiteViewProps {
  tenantSlug: string
}

export function StaticSiteView({ tenantSlug }: StaticSiteViewProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [site, setSite] = useState<StaticSite | null>(null)
  const [versions, setVersions] = useState<SiteVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string>(SCHEMA_MODEL_OPTIONS[0].value)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)

  const siteUrl = `https://${tenantSlug}.${ROOT_DOMAIN}`
  const hasPendingDraft = !!site?.draftAt

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [siteRes, versionsRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/static-site`),
        fetch(`/api/tenant/${tenantSlug}/static-site/versions`),
      ])
      const siteData = await siteRes.json()
      const versionsData = await versionsRes.json()
      setSite(siteData.site || null)
      setVersions(versionsData.versions || [])
      if (siteData.site?.draftPrompt) setPrompt(siteData.site.draftPrompt)
      else if (siteData.site?.prompt) setPrompt(siteData.site.prompt)
    } catch {
      // Compose form below still works even if this fails.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [tenantSlug])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal membuat draft website")
      setSite(data.site)
      toast({ title: "Draft Siap", description: "Tinjau dulu lewat Preview sebelum di-publish." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Membuat Draft", description: err.message })
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/publish`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal publish website")
      setSite(data.site)
      fetchAll()
      toast({ title: "Website Live!", description: `Sudah bisa diakses di ${siteUrl}` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Publish", description: err.message })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleTogglePublished = async (nextPublished: boolean) => {
    if (!nextPublished) {
      const ok = await confirm({
        title: "Unpublish website ini?",
        description: "Subdomain Anda akan kembali menampilkan CMS Studio. Konten tetap tersimpan, bisa dipublish lagi kapan saja.",
        confirmLabel: "Unpublish",
        variant: "destructive",
      })
      if (!ok) return
    }

    setIsToggling(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: nextPublished }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal mengubah status publish")
      setSite(data.site)
      toast({ title: nextPublished ? "Website Dipublish" : "Website Di-unpublish" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setIsToggling(false)
    }
  }

  const handleRollback = async (version: SiteVersion) => {
    if (
      !(await confirm({
        title: "Rollback ke versi ini?",
        description: "Versi yang sedang live akan disimpan ke riwayat juga, jadi Anda tetap bisa maju lagi kalau berubah pikiran.",
        confirmLabel: "Rollback",
        variant: "destructive",
      }))
    )
      return

    setRollingBackId(version.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site/versions/${version.id}/rollback`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal rollback")
      setSite(data.site)
      fetchAll()
      toast({ title: "Rollback Berhasil", description: "Website kembali ke versi tersebut." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Rollback", description: err.message })
    } finally {
      setRollingBackId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  return (
    <div className="space-y-6">
      {confirmDialog}

      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-primary/5 p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Zap className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold tracking-tight text-foreground">Website Gratis & Instan</h3>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
              AI membuat satu halaman statis (HTML + Alpine.js, tanpa build) yang mengambil data dari API SaCMS Anda sendiri. Setiap generate jadi <strong>draft</strong> dulu — tinjau lewat Preview sebelum Publish. Untuk kebutuhan lebih kompleks, tetap gunakan tab <strong>Hosting</strong> (Vercel).
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat status website...
        </div>
      ) : (
        <>
          {site?.html && (
            <Card className="rounded-2xl border-border/80 shadow-xs">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={site.published}
                    disabled={isToggling}
                    onCheckedChange={handleTogglePublished}
                  />
                  {site.published ? (
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" /> Live
                      </Badge>
                      <a
                        href={siteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-foreground hover:text-primary inline-flex items-center gap-1"
                      >
                        {siteUrl} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">Tidak dipublish — subdomain menampilkan CMS Studio</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {hasPendingDraft && (
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-xs">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-bold">Draft Belum Dipublish</Badge>
                  <span className="text-xs text-muted-foreground">Dibuat {site?.draftAt ? formatDate(site.draftAt) : ""}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 font-bold text-xs rounded-xl">
                    <a href={`/api/tenant/${tenantSlug}/static-site/preview`} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-3.5 w-3.5" /> Preview Draft
                    </a>
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing} size="sm" className="h-8 gap-1.5 font-bold text-xs rounded-xl">
                    {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    Publish Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                {site?.html ? "Generate Ulang (Draft Baru)" : "Buat Website"}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Jelaskan bisnis Anda — AI merancang halaman lengkap mengambil data dari schema CMS Anda sendiri.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              <div className="rounded-2xl bg-muted/20 border border-border/80 overflow-visible">
                <Textarea
                  placeholder="Contoh: Toko kopi UMKM dengan profil usaha, daftar menu dari Content Type produk, dan info kontak/lokasi."
                  className="resize-none min-h-[88px] text-sm rounded-2xl border-0 shadow-none bg-transparent p-4 focus-visible:ring-0"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 border-t border-border/50">
                  <Cpu className="h-3 w-3 text-muted-foreground shrink-0" />
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none hover:bg-muted/50 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {SCHEMA_MODEL_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg">
                          <span className="font-semibold">{opt.label}</span>
                          <span className="text-muted-foreground ml-1.5">— {opt.hint}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="h-9 gap-1.5 font-bold text-xs rounded-xl shadow-xs"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isGenerating ? "Membuat Draft..." : "Generate Draft dengan AI"}
              </Button>
            </CardContent>
          </Card>

          {versions.length > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" /> Riwayat Versi ({versions.length})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Versi sebelumnya yang pernah live — bisa dikembalikan kapan saja.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-1.5">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{v.prompt || "(tanpa prompt)"}</p>
                      <p className="text-[10px] text-muted-foreground">{formatDate(v.publishedAt)}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRollback(v)}
                      disabled={rollingBackId === v.id}
                      className="h-7 gap-1.5 font-bold text-[11px] rounded-lg shrink-0"
                    >
                      {rollingBackId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      Rollback
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
