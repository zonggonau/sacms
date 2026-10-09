"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Zap, Loader2, ExternalLink, Cpu, Sparkles, Eye, UploadCloud, History,
  RotateCcw, Copy, Check, Globe, FileCode2, ShieldCheck, Lightbulb, Clock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
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
  const [copied, setCopied] = useState(false)

  const siteUrl = `https://${tenantSlug}.${ROOT_DOMAIN}`
  const hasSite = !!site?.html
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

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard permission denied — non-critical, link is still visible/clickable.
    }
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat status website...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* ── Status strip — deployment-style bar, only once a site has ever existed ── */}
      {hasSite && (
        <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border",
                    site?.published
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                >
                  <Globe className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("relative flex h-2 w-2 rounded-full", site?.published ? "bg-emerald-500" : "bg-muted-foreground/40")}>
                      {site?.published && <span className="absolute inset-0 rounded-full bg-emerald-500 animate-ping" />}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {site?.published ? "Live" : "Belum Dipublish"}
                    </span>
                    {site?.published && (
                      <Badge variant="outline" className="text-[9px] font-bold uppercase text-muted-foreground border-border/80">
                        Static · Alpine.js
                      </Badge>
                    )}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-primary transition-colors mt-0.5 truncate max-w-full cursor-pointer"
                  >
                    <span className="truncate">{siteUrl}</span>
                    {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-500" /> : <Copy className="h-3 w-3 shrink-0" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                <div className="flex items-center gap-2">
                  <Switch checked={site?.published ?? false} disabled={isToggling} onCheckedChange={handleTogglePublished} />
                  <span className="text-xs font-semibold text-muted-foreground">Publish</span>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 font-bold text-xs rounded-xl">
                  <a href={siteUrl} target="_blank" rel="noopener noreferrer">
                    Kunjungi <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Pending draft callout ── */}
      {hasPendingDraft && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <FileCode2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Draft menunggu di-publish</p>
              <p className="text-[11px] text-muted-foreground">Dibuat {site?.draftAt ? formatDate(site.draftAt) : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 font-bold text-xs rounded-xl">
              <a href={`/api/tenant/${tenantSlug}/static-site/preview`} target="_blank" rel="noopener noreferrer">
                <Eye className="h-3.5 w-3.5" /> Preview
              </a>
            </Button>
            <Button onClick={handlePublish} disabled={isPublishing} size="sm" className="h-8 gap-1.5 font-bold text-xs rounded-xl shadow-xs">
              {isPublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
              Publish Draft
            </Button>
          </div>
        </div>
      )}

      {/* ── Main grid: composer (2/3) + sidebar (1/3) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card h-full">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {hasSite ? "Generate Ulang (Draft Baru)" : "Buat Website Pertama Anda"}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Jelaskan bisnis Anda — AI merancang halaman lengkap mengambil data dari schema CMS yang sudah ada.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3">
              <div className="rounded-2xl bg-muted/20 border border-border/80 focus-within:border-primary/40 transition-colors overflow-visible">
                <Textarea
                  placeholder="Contoh: Toko kopi UMKM dengan profil usaha, daftar menu dari Content Type produk, dan info kontak/lokasi."
                  className="resize-none min-h-[120px] text-sm rounded-2xl border-0 shadow-none bg-transparent p-4 focus-visible:ring-0"
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
            </CardContent>
            <CardFooter className="p-5 pt-0">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !prompt.trim()}
                className="h-10 gap-1.5 font-bold text-xs rounded-xl shadow-xs px-5"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {isGenerating ? "Membuat Draft..." : "Generate Draft dengan AI"}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-primary/20 bg-primary/5 shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-primary" /> Cara Kerjanya
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2.5">
              {[
                ["1", "Generate", "AI merancang halaman dari schema CMS Anda — jadi draft dulu."],
                ["2", "Preview", "Tinjau hasilnya sebelum siapa pun bisa melihatnya."],
                ["3", "Publish", "Sekali klik, langsung live di subdomain Anda."],
              ].map(([n, title, desc]) => (
                <div key={n} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {n}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
              <Separator className="my-2" />
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tanpa build, tanpa server tambahan — cocok untuk UMKM/profil bisnis sederhana. Untuk kebutuhan lebih kompleks, gunakan tab <strong className="text-foreground">Hosting</strong> (Vercel).
                </p>
              </div>
            </CardContent>
          </Card>

          {versions.length > 0 && (
            <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-primary" /> Riwayat Versi
                  <Badge variant="outline" className="text-[9px] font-bold ml-auto">{versions.length}</Badge>
                </CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">
                  Versi sebelumnya yang pernah live.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-1.5 max-h-80 overflow-y-auto">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate">{v.prompt || "(tanpa prompt)"}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5" /> {formatDate(v.publishedAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRollback(v)}
                      disabled={rollingBackId === v.id}
                      title="Rollback ke versi ini"
                      className="h-7 w-7 rounded-lg shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    >
                      {rollingBackId === v.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
