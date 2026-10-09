"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Zap, Loader2, ExternalLink, Cpu, EyeOff, Sparkles } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { ROOT_DOMAIN } from "@/lib/portal-urls"
import { SCHEMA_MODEL_OPTIONS } from "../../developer/aischema/schema-step"

interface StaticSite {
  id: string
  prompt: string | null
  published: boolean
  updatedAt: string
}

interface StaticSiteViewProps {
  tenantSlug: string
}

export function StaticSiteView({ tenantSlug }: StaticSiteViewProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [site, setSite] = useState<StaticSite | null>(null)
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string>(SCHEMA_MODEL_OPTIONS[0].value)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isUnpublishing, setIsUnpublishing] = useState(false)

  const siteUrl = `https://${tenantSlug}.${ROOT_DOMAIN}`

  const fetchSite = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`)
      const data = await res.json()
      setSite(data.site || null)
      if (data.site?.prompt) setPrompt(data.site.prompt)
    } catch {
      // Fine to stay empty — the compose form below still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSite()
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
      if (!res.ok) throw new Error(data?.error || "Gagal membuat website")
      setSite(data.site)
      toast({ title: "Website Live!", description: `Sudah bisa diakses di ${siteUrl}` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Membuat Website", description: err.message })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleUnpublish = async () => {
    if (
      !(await confirm({
        title: "Unpublish website ini?",
        description: "Subdomain Anda akan kembali menampilkan CMS Studio alih-alih website ini. Draft tetap tersimpan, bisa dipublish lagi kapan saja.",
        confirmLabel: "Unpublish",
        variant: "destructive",
      }))
    )
      return

    setIsUnpublishing(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/static-site`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal unpublish")
      setSite((prev) => (prev ? { ...prev, published: false } : prev))
      toast({ title: "Website Di-unpublish", description: "Subdomain kembali ke CMS Studio." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setIsUnpublishing(false)
    }
  }

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
              AI membuat satu halaman statis (HTML + Alpine.js, tanpa build) yang mengambil data dari API SaCMS Anda sendiri, langsung live di subdomain — cocok untuk UMKM/profil bisnis sederhana. Untuk kebutuhan lebih kompleks, tetap gunakan tab <strong>Hosting</strong> (Vercel).
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
          {site?.published && (
            <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 shadow-xs">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnpublish}
                  disabled={isUnpublishing}
                  className="h-8 gap-1.5 font-bold text-xs rounded-xl shrink-0"
                >
                  {isUnpublishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Unpublish
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold text-foreground">
                {site ? "Perbarui Website" : "Buat Website"}
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
                {isGenerating ? "Membuat Website..." : site ? "Perbarui & Publish" : "Buat & Publish"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
