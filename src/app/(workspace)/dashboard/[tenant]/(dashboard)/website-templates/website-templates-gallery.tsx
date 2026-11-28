"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutTemplate, Trash2, Filter, ExternalLink, LayoutGrid, Table2 as TableIcon, Rocket, Search, AlertTriangle, ShoppingCart } from "lucide-react"
import { getWebsitePreviewUrl, gradientFor } from "@/lib/website-preview"

interface WebsiteTemplateItem {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  published: boolean
  createdAt?: string
  demoUrl?: string | null
  price?: number | null
  /** included: Enterprise gets unpriced templates free; owned: bought; purchasable: priced, not yet bought; unavailable: not for sale to this plan */
  access?: "included" | "owned" | "purchasable"
  isStarter?: boolean
  schemaTemplate: { id: string; name: string; slug: string; icon: string }
}

const formatRupiah = (value: number) => "Rp " + value.toLocaleString("id-ID")

interface WebsiteTemplatesTabProps {
  tenantSlug: string
  /** This workspace's own staff role for the signed-in user — the "Reset &
   *  Pilih Template Lain" banner (which can wipe the whole workspace's
   *  hosting + schema) only ever renders for "owner", never admin/editor/
   *  etc., even though the backend route itself already accepts "admin"
   *  too (owner just never has to go looking for a way to call it). */
  currentRole: string
  /** Whether this workspace currently has no Content Type/Single Type/Component at all — mirrors the
   *  same empty-workspace check the apply route itself gates on. When false, a regular tenant needs to
   *  reset before a NEW template can be applied. */
  isWorkspaceEmpty: boolean
  /** free: every template free for this plan; purchase: Standar/Pro/Bisnis buy each template; locked: plan cannot use templates. */
  planAccess: "free" | "purchase" | "locked"
  /** Called after a successful "Terapkan" — parent switches to Diagram Schema and refreshes live schema. */
  onApplied?: () => void
  /** Called after a successful reset — parent just refreshes live schema; does NOT switch tabs, since the
   *  user's next action is picking a new template right here. */
  onReset?: () => void
}

const ALL_SCHEMAS = "__all__"

export function WebsiteTemplatesTab({ tenantSlug, currentRole, isWorkspaceEmpty, planAccess, onApplied, onReset }: WebsiteTemplatesTabProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<WebsiteTemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [schemaFilter, setSchemaFilter] = useState(ALL_SCHEMAS)
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [purchasingId, setPurchasingId] = useState<string | null>(null)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmApplyTemplate, setConfirmApplyTemplate] = useState<WebsiteTemplateItem | null>(null)

  const fetchTemplates = () => {
    setIsLoading(true)
    fetch(`/api/tenant/${tenantSlug}/website-templates`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) setTemplates(data.templates)
        setPendingTemplateId(data?.pendingTemplateId ?? null)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }

  useEffect(() => {
    const onFocus = () => fetchTemplates()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  useEffect(() => {
    fetchTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  const handlePurchase = async (template: WebsiteTemplateItem) => {
    setPurchasingId(template.id)
    // Open the tab now, while the click still counts as a user gesture. Opening it
    // after the fetch lets browsers block it as a pop-up, so nothing visible happens.
    const payTab = window.open("about:blank", "_blank")
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/website-templates/${template.id}/purchase`, { method: "POST" })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.redirectUrl) throw new Error(data?.error?.message || data?.error || "Gagal memulai pembayaran")
      if (payTab) {
        payTab.location.href = data.redirectUrl
      } else {
        // Pop-up blocked: continue in this tab instead.
        window.location.assign(data.redirectUrl)
        return
      }
      toast({ title: "Selesaikan pembayaran", description: `Halaman pembayaran "${template.name}" dibuka di tab baru. Template bisa diterapkan setelah pembayaran terkonfirmasi.` })
    } catch (err: any) {
      payTab?.close()
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setPurchasingId(null)
    }
  }

  const handleApply = async (template: WebsiteTemplateItem) => {
    setApplyingId(template.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/website-templates/${template.id}/apply`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menerapkan Website Template")
      const envNote = data.envVarsApplied?.length
        ? ` ${data.envVarsApplied.length} variabel environment (${data.envVarsApplied.join(", ")}) otomatis diisi dengan nilai production.`
        : ""
      toast({
        title: "Website Template Diterapkan",
        description: "Schema dan source website tersimpan. Tinjau preview sebelum merilis dari Infrastruktur → Hosting." + envNote,
      })
      onApplied?.()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menerapkan", description: err.message })
    } finally {
      setApplyingId(null)
      fetchTemplates()
    }
  }

  const handleReset = async () => {
    setIsResetting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/deploy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-website" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal reset website")
      toast({ title: "Website Direset", description: "Project hosting dan schema lama sudah dihapus — silakan pilih Website Template baru." })
      onReset?.()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Reset", description: err.message })
    } finally {
      setIsResetting(false)
      setConfirmResetOpen(false)
    }
  }

  const schemaOptions = useMemo(
    () => Array.from(new Map(templates.map((t) => [t.schemaTemplate.slug, t.schemaTemplate.name])).entries()),
    [templates],
  )

  const matchesSearch = (t: WebsiteTemplateItem) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)
  }

  const SearchBox = () => (
    <div className="relative w-[200px] shrink-0">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari template..."
        className="h-8 pl-8 text-xs rounded-xl"
      />
    </div>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat website template...
      </div>
    )
  }

  const SchemaFilterSelect = () => (
    <Select value={schemaFilter} onValueChange={setSchemaFilter}>
      <SelectTrigger className="h-8 w-[200px] text-xs rounded-xl">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <SelectValue placeholder="Semua Schema Template" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SCHEMAS} className="text-xs">Semua Schema Template</SelectItem>
        {schemaOptions.map(([slug, name]) => (
          <SelectItem key={slug} value={slug} className="text-xs">{name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  // ── Regular tenant: browse & apply table (published templates only) ──
  const published = templates.filter((t) => t.published)
  const visibleTemplates = (schemaFilter === ALL_SCHEMAS ? published : published.filter((t) => t.schemaTemplate.slug === schemaFilter)).filter(matchesSearch)

  // Too dangerous to risk the wrong person clicking it (wipes hosting +
  // all schema/content permanently) — the banner, and the button inside
  // it, render ONLY for the workspace's owner. The backend route itself
  // still accepts "admin" too (defense in depth, not a second way in from
  // this UI) — an owner simply never has to go looking for another way to
  // call it.
  const isOwner = currentRole === "owner"
  // "Terapkan" itself is already gated to owner/admin on the backend
  // (POST .../website-templates/[id]/apply requires minRole: "admin",
  // which owner also satisfies) — disabling it here too for anyone below
  // that is just a clearer failure mode than letting them click it and
  // get a 403 back.
  const canApply = currentRole === "owner" || currentRole === "admin"
  const canApplyTemplate = (t: WebsiteTemplateItem) =>
    canApply && (t.access === "owned" || t.access === "included") && !isResetting && applyingId === null &&
    (pendingTemplateId ? pendingTemplateId === t.id : true)

  // One action per template, shared by the card and table layouts.
  const renderAction = (t: WebsiteTemplateItem, layout: "card" | "table") => {
    const size = layout === "card" ? "h-7 flex-1 rounded-lg text-[11px] font-bold gap-1.5" : "h-7 rounded-lg text-[11px] font-bold gap-1.5"
    const wrap = layout === "card" ? "flex-1 inline-flex" : "inline-flex"
    if (t.access === "purchasable" && t.price) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className={wrap}>
              <Button size="sm" onClick={() => handlePurchase(t)} disabled={!canApply || purchasingId !== null} className={size}>
                {purchasingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
                Beli {formatRupiah(t.price)}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{canApply ? "Sekali bayar, bisa diterapkan kapan saja di workspace ini" : "Hanya owner dan admin workspace yang bisa membeli template"}</TooltipContent>
        </Tooltip>
      )
    }
    const reason =
      !canApply ? "Hanya owner dan admin workspace yang bisa menerapkan template"
      : "Lanjutkan template yang tertunda atau reset workspace"
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={wrap}>
            <Button size="sm" onClick={() => setConfirmApplyTemplate(t)} disabled={!canApplyTemplate(t)} className={size}>
              {applyingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
              {pendingTemplateId === t.id ? "Lanjutkan" : "Terapkan"}
            </Button>
          </span>
        </TooltipTrigger>
        {!canApplyTemplate(t) && <TooltipContent>{reason}</TooltipContent>}
      </Tooltip>
    )
  }

  const priceBadge = (t: WebsiteTemplateItem) =>
    t.access === "owned" ? (
      <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Dimiliki</Badge>
    ) : t.access === "included" ? (
      <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Gratis</Badge>
    ) : t.access === "purchasable" && t.price ? (
      <Badge variant="outline" className="text-[10px] font-bold">{formatRupiah(t.price)}</Badge>
    ) : null

  const ResetBanner = () => (
    <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-xs">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-bold text-foreground">Workspace ini sudah punya schema dan/atau website aktif</p>
          <p className="text-[11px] text-muted-foreground">
            Menerapkan Website Template akan menghapus semua Content Type/Single Type/Component beserta kontennya, lalu menggantinya dengan schema template. Reset total juga menghapus project hosting.
            Kalau cuma mau mengubah sebagian website yang sudah diterapkan, tidak perlu reset — langsung edit lewat ChatGPT/MCP di tab{" "}
            <a href={`/dashboard/${tenantSlug}/developer/mcp`} className="font-semibold underline underline-offset-2 hover:text-foreground">Server MCP</a>.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmResetOpen(true)}
            className="h-7 mt-1 rounded-lg text-[11px] font-bold gap-1.5"
          >
            <Trash2 className="h-3 w-3" /> Reset &amp; Pilih Template Lain
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  // Shown to a non-owner (admin/editor/...) instead of the banner above —
  // explains WHY they can't proceed, without offering the destructive
  // action itself at all.
  const OwnerOnlyResetNotice = () => (
    <Card className="rounded-2xl border-border/70 bg-muted/20 shadow-xs">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="h-4.5 w-4.5 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-bold text-foreground">Workspace ini sudah punya schema dan/atau website aktif</p>
          <p className="text-[11px] text-muted-foreground">
            Menerapkan Website Template akan mengganti schema workspace ini — hanya <strong className="text-foreground">owner</strong> workspace ini yang bisa melakukannya.
            Kalau cuma mau mengubah sebagian website yang sudah diterapkan, tidak perlu reset — langsung edit lewat ChatGPT/MCP di tab{" "}
            <a href={`/dashboard/${tenantSlug}/developer/mcp`} className="font-semibold underline underline-offset-2 hover:text-foreground">Server MCP</a>.
          </p>
        </div>
      </CardContent>
    </Card>
  )

  if (published.length === 0) {
    return (
      <div className="space-y-3">
        {!isWorkspaceEmpty && (isOwner ? <ResetBanner /> : <OwnerOnlyResetNotice />)}
        <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
          <LayoutTemplate className="h-6 w-6 opacity-50" />
          <p className="text-xs">Belum ada Website Template tersedia.</p>
        </div>
        <ConfirmDialog
          open={confirmResetOpen}
          onOpenChange={setConfirmResetOpen}
          title="Reset total workspace ini?"
          description="Project hosting Vercel akan dihapus, SEMUA Content Type/Single Type/Component beserta kontennya akan dihapus permanen, dan koneksi ke template sebelumnya akan diputus. Setelah itu schema starter default dimuat ulang. Tindakan ini tidak bisa dibatalkan."
          confirmLabel={isResetting ? "Mereset..." : "Hapus & Reset"}
          variant="destructive"
          onConfirm={handleReset}
        />
      </div>
    )
  }

  const ViewToggle = () => (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl border border-border/60 bg-muted/30 shrink-0">
      <Button
        type="button"
        variant={viewMode === "card" ? "default" : "ghost"}
        size="sm"
        onClick={() => setViewMode("card")}
        className="h-7 rounded-lg px-2.5 text-[11px] font-bold gap-1.5"
      >
        <LayoutGrid className="h-3 w-3" /> Card
      </Button>
      <Button
        type="button"
        variant={viewMode === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => setViewMode("table")}
        className="h-7 rounded-lg px-2.5 text-[11px] font-bold gap-1.5"
      >
        <TableIcon className="h-3 w-3" /> Tabel
      </Button>
    </div>
  )

  return (
    <div className="space-y-3">
      {planAccess === "purchase" && (
        <p className="text-[11px] text-muted-foreground">
          Template berharga dibeli sekali dan berlaku seumur hidup untuk workspace ini. Template tanpa harga gratis untuk semua plan.</p>
      )}
      {!isWorkspaceEmpty && (isOwner ? <ResetBanner /> : <OwnerOnlyResetNotice />)}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Galeri Website Template ({visibleTemplates.length})</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Frontend siap pakai dari tim SaCMS — buka demonya di tab baru, lalu <strong>Terapkan</strong> kalau sudah sesuai.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox />
          {schemaOptions.length > 0 && <SchemaFilterSelect />}
          <ViewToggle />
        </div>
      </div>

      {visibleTemplates.length === 0 ? (
        <Card className="rounded-2xl border-border/80 shadow-xs bg-card">
          <CardContent className="text-center py-16 text-muted-foreground">
            <LayoutTemplate className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="font-bold text-xs text-foreground">Tidak ada Website Template yang cocok</p>
          </CardContent>
        </Card>
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visibleTemplates.map((t) => (
            <Card
              key={t.id}
              className="group rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden flex flex-col transition-shadow hover:shadow-md"
            >
              {/* A real <iframe> pointed at the demo blocked itself via its
                  own frame-ancestors/X-Frame-Options header — confirmed
                  live, every template's deployed Next.js app sends one by
                  default, and that header only blocks FRAMING, not a
                  plain resource fetch. A screenshot <img> sidesteps it
                  entirely. The gradient+icon tile stays underneath as a
                  loading/error fallback — it's what's visible until the
                  screenshot loads, and stays visible if it never does. */}
              <a
                href={t.demoUrl || undefined}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!t.demoUrl}
                className={`relative aspect-[16/10] w-full overflow-hidden border-b border-border/60 ${t.demoUrl ? "cursor-pointer" : "cursor-default pointer-events-none"}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradientFor(t.id)} bg-muted/30`} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-5xl drop-shadow-sm" aria-hidden>{t.icon}</span>
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
                {t.demoUrl ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-bold text-background">
                      <ExternalLink className="h-3 w-3" /> Lihat Demo
                    </span>
                  </div>
                ) : (
                  <span className="absolute bottom-2 right-2 rounded-full bg-background/80 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground backdrop-blur-sm">
                    Demo belum tersedia
                  </span>
                )}
              </a>
              <CardContent className="p-3.5 flex flex-col gap-2.5 flex-1">
                <div className="flex items-start gap-2 min-w-0">
                  <span className="text-base shrink-0">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate">{t.name}</p>
                    {t.description && <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{t.description}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 self-start">
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary gap-1">
                    {t.schemaTemplate.icon} {t.schemaTemplate.name}
                  </Badge>
                  {priceBadge(t)}
                </div>
                <div className="flex items-center gap-2 mt-auto pt-1">
                  {t.demoUrl ? (
                    <Button variant="outline" size="sm" asChild className="h-7 flex-1 rounded-lg text-[11px] font-bold gap-1.5">
                      <a href={t.demoUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" /> Buka Tab
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled className="h-7 flex-1 rounded-lg text-[11px] font-bold gap-1.5">
                      <ExternalLink className="h-3 w-3" /> Buka Tab
                    </Button>
                  )}
                  {renderAction(t, "card")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30 border-b border-border/60">
                <TableRow>
                  <TableHead className="font-bold text-xs pl-6">Template</TableHead>
                  <TableHead className="font-bold text-xs">Mengikuti Schema</TableHead>
                  <TableHead className="text-right pr-6 font-bold text-xs">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTemplates.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                    <TableCell className="pl-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-base shrink-0">{t.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground">{t.name}</p>
                          {t.description && <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-sm">{t.description}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary gap-1">{t.schemaTemplate.icon} {t.schemaTemplate.name}</Badge>
                        {priceBadge(t)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.demoUrl ? (
                          <Button variant="outline" size="sm" asChild className="h-7 rounded-lg text-[11px] font-bold gap-1.5">
                            <a href={t.demoUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" /> Buka Tab
                            </a>
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled className="h-7 rounded-lg text-[11px] font-bold gap-1.5">
                            <ExternalLink className="h-3 w-3" /> Buka Tab
                          </Button>
                        )}
                        {renderAction(t, "table")}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={!!confirmApplyTemplate}
        onOpenChange={(open) => { if (!open) setConfirmApplyTemplate(null) }}
        title={`Terapkan "${confirmApplyTemplate?.name ?? "template"}"?`}
        description="Semua Content Type, Single Type, dan Component beserta kontennya di workspace ini akan dihapus permanen, lalu schema dari template ini diterapkan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus & Terapkan"
        variant="destructive"
        onConfirm={() => {
          const template = confirmApplyTemplate
          setConfirmApplyTemplate(null)
          if (template) void handleApply(template)
        }}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset total workspace ini?"
        description="Project hosting Vercel akan dihapus, SEMUA Content Type/Single Type/Component beserta kontennya akan dihapus permanen, dan koneksi ke template sebelumnya akan diputus. Setelah itu schema starter default dimuat ulang. Tindakan ini tidak bisa dibatalkan."
        confirmLabel={isResetting ? "Mereset..." : "Hapus & Reset"}
        variant="destructive"
        onConfirm={handleReset}
      />
    </div>
  )
}
