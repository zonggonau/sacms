"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutTemplate, Eye, Trash2, Filter, ExternalLink, LayoutGrid, Table2 as TableIcon, Rocket, Search, AlertTriangle } from "lucide-react"
import { WebsiteTemplateReviewDialog } from "./website-template-review-dialog"
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
  schemaTemplate: { id: string; name: string; slug: string; icon: string }
}

interface WebsiteTemplatesTabProps {
  tenantSlug: string
  isGlobal: boolean
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
  /** Called after a successful "Terapkan" — parent switches to Diagram Schema and refreshes live schema. */
  onApplied?: () => void
  /** Called after a successful reset — parent just refreshes live schema; does NOT switch tabs, since the
   *  user's next action is picking a new template right here. */
  onReset?: () => void
}

const ALL_SCHEMAS = "__all__"

export function WebsiteTemplatesTab({ tenantSlug, isGlobal, currentRole, isWorkspaceEmpty, onApplied, onReset }: WebsiteTemplatesTabProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<WebsiteTemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [schemaFilter, setSchemaFilter] = useState(ALL_SCHEMAS)
  const [search, setSearch] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<WebsiteTemplateItem | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"card" | "table">("card")
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null)
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

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
    fetchTemplates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug])

  const handleTogglePublish = async (template: WebsiteTemplateItem) => {
    setPendingId(template.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/website-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !template.published }),
      })
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal mengubah status publish")
      const data = await res.json()
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, published: data.template.published } : t)))
      toast({
        title: !template.published ? "Template Dipublish" : "Dikembalikan ke Draft",
        description: !template.published
          ? `"${template.name}" sekarang terlihat di tab Website Template semua workspace.`
          : `"${template.name}" sekarang draft — hanya terlihat oleh SaCMS Global.`,
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setPendingId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteDialog) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/website-templates/${deleteDialog.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal menghapus template")
      setTemplates((prev) => prev.filter((t) => t.id !== deleteDialog.id))
      toast({ title: "Template Dihapus", description: `"${deleteDialog.name}" telah dihapus.` })
      setDeleteDialog(null)
      setDeleteConfirmName("")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setIsDeleting(false)
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

  // ── SaCMS Global: management table (publish toggle + delete) ──
  if (isGlobal) {
    const formatDate = (iso?: string) =>
      iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"
    const filtered = (schemaFilter === ALL_SCHEMAS ? templates : templates.filter((t) => t.schemaTemplate.slug === schemaFilter)).filter(matchesSearch)

    return (
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground max-w-lg">
          Website Template dibuat lewat ChatGPT/IDE yang terhubung ke MCP SaCMS Global (<code className="font-mono">create_website_template</code>) — tidak ada form di sini. <strong>Publish</strong> membuatnya terlihat di semua workspace.
        </p>

        <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex-row items-center justify-between gap-3 flex-wrap space-y-0">
            <CardTitle className="text-sm font-bold text-foreground">Daftar Website Template ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <SearchBox />
              {schemaOptions.length > 0 && <SchemaFilterSelect />}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <LayoutTemplate className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-bold text-xs text-foreground">
                  {templates.length === 0 ? "Belum ada Website Template" : "Tidak ada template yang cocok"}
                </p>
                {templates.length === 0 && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Buat lewat MCP SaCMS Global (<code className="font-mono">create_website_template</code>).</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/60">
                  <TableRow>
                    <TableHead className="font-bold text-xs pl-6">Template</TableHead>
                    <TableHead className="font-bold text-xs">Mengikuti Schema</TableHead>
                    <TableHead className="font-bold text-xs">Dibuat</TableHead>
                    <TableHead className="font-bold text-xs">Publish</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors">
                      <TableCell className="pl-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{t.icon}</span>
                          <div>
                            <p className="text-xs font-bold text-foreground">{t.name}</p>
                            {t.description && <p className="text-[10px] text-muted-foreground line-clamp-1 max-w-xs">{t.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="text-[10px] font-bold gap-1">{t.schemaTemplate.icon} {t.schemaTemplate.name}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground py-3">{formatDate(t.createdAt)}</TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.published}
                            disabled={pendingId === t.id}
                            onCheckedChange={() => handleTogglePublish(t)}
                          />
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {t.published ? "Published" : "Draft"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {t.demoUrl ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                >
                                  <a href={t.demoUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{`Buka Demo: ${t.demoUrl}`}</TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="h-7 w-7 inline-flex items-center justify-center text-muted-foreground/30" title="Demo belum tersedia">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setReviewId(t.id)}
                            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Lihat File"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteDialog(t)}
                            disabled={pendingId === t.id}
                            className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10"
                            title="Hapus Template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog
          open={!!deleteDialog}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteDialog(null)
              setDeleteConfirmName("")
            }
          }}
        >
          <DialogContent className="rounded-2xl border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                <Trash2 className="h-4 w-4" /> Hapus Website Template?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Tindakan ini akan menghapus template <strong className="text-foreground font-bold">"{deleteDialog?.name}"</strong> secara permanen. Workspace yang sudah pernah menerapkannya tidak terpengaruh.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="p-3 bg-destructive/10 rounded-xl border border-destructive/20 text-xs">
                <p className="font-semibold text-destructive">Ketik nama template persis untuk konfirmasi:</p>
                <p className="font-mono font-bold mt-1 text-foreground">{deleteDialog?.name}</p>
              </div>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Ketik nama template"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="ghost"
                className="rounded-xl text-xs"
                onClick={() => {
                  setDeleteDialog(null)
                  setDeleteConfirmName("")
                }}
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="rounded-xl text-xs font-bold"
                onClick={handleDelete}
                disabled={deleteConfirmName !== deleteDialog?.name || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Menghapus...
                  </>
                ) : (
                  "Hapus Permanen"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <WebsiteTemplateReviewDialog
          open={!!reviewId}
          onOpenChange={(open) => !open && setReviewId(null)}
          tenantSlug={tenantSlug}
          websiteTemplateId={reviewId}
          isGlobal
        />
      </div>
    )
  }

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
  const canApplyTemplate = (id: string) =>
    canApply && !isResetting && applyingId === null &&
    (pendingTemplateId ? pendingTemplateId === id : isWorkspaceEmpty)

  const ResetBanner = () => (
    <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-xs">
      <CardContent className="p-4 flex items-start gap-3">
        <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-bold text-foreground">Workspace ini sudah punya schema dan/atau website aktif</p>
          <p className="text-[11px] text-muted-foreground">
            Menerapkan Website Template baru memerlukan reset total dulu — project hosting dan semua Content Type/Single Type/Component beserta kontennya akan dihapus permanen.
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
            Menerapkan Website Template baru memerlukan reset total workspace — hanya <strong className="text-foreground">owner</strong> workspace ini yang bisa melakukannya.
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
          description="Project hosting Vercel akan dihapus, SEMUA Content Type/Single Type/Component beserta kontennya akan dihapus permanen, dan koneksi ke template sebelumnya akan diputus. Tindakan ini tidak bisa dibatalkan."
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
                <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary gap-1 self-start">
                  {t.schemaTemplate.icon} {t.schemaTemplate.name}
                </Badge>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/* span, not the Button itself — Button's own
                          disabled:pointer-events-none would block hover
                          from ever reaching it once !canApplyTemplate,
                          the exact state this tooltip explains. */}
                      <span tabIndex={0} className="flex-1 inline-flex">
                        <Button
                          size="sm"
                          onClick={() => handleApply(t)}
                          disabled={!canApplyTemplate(t.id)}
                          className="h-7 flex-1 rounded-lg text-[11px] font-bold gap-1.5"
                        >
                          {applyingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                          {pendingTemplateId === t.id ? "Lanjutkan" : "Terapkan"}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {(!canApply || !canApplyTemplate(t.id)) && (
                      <TooltipContent>{!canApply ? "Hanya owner dan admin workspace yang bisa menerapkan template" : "Lanjutkan template yang tertunda atau reset workspace"}</TooltipContent>
                    )}
                  </Tooltip>
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
                      <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary gap-1">{t.schemaTemplate.icon} {t.schemaTemplate.name}</Badge>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="inline-flex">
                              <Button
                                size="sm"
                                onClick={() => handleApply(t)}
                                disabled={!canApplyTemplate(t.id)}
                                className="h-7 rounded-lg text-[11px] font-bold gap-1.5"
                              >
                                {applyingId === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
                                {pendingTemplateId === t.id ? "Lanjutkan" : "Terapkan"}
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {(!canApply || !canApplyTemplate(t.id)) && (
                            <TooltipContent>{!canApply ? "Hanya owner dan admin workspace yang bisa menerapkan template" : "Lanjutkan template yang tertunda atau reset workspace"}</TooltipContent>
                          )}
                        </Tooltip>
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
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset total workspace ini?"
        description="Project hosting Vercel akan dihapus, SEMUA Content Type/Single Type/Component beserta kontennya akan dihapus permanen, dan koneksi ke template sebelumnya akan diputus. Tindakan ini tidak bisa dibatalkan."
        confirmLabel={isResetting ? "Mereset..." : "Hapus & Reset"}
        variant="destructive"
        onConfirm={handleReset}
      />
    </div>
  )
}
