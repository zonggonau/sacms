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
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutTemplate, Eye, Trash2, Filter, ExternalLink } from "lucide-react"
import { WebsiteTemplateReviewDialog } from "./website-template-review-dialog"

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
  /** Called after a successful "Terapkan" — parent switches to Diagram Schema and refreshes live schema. */
  onApplied?: () => void
}

const ALL_SCHEMAS = "__all__"

export function WebsiteTemplatesTab({ tenantSlug, isGlobal, onApplied }: WebsiteTemplatesTabProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<WebsiteTemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [schemaFilter, setSchemaFilter] = useState(ALL_SCHEMAS)
  const [deleteDialog, setDeleteDialog] = useState<WebsiteTemplateItem | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [reviewId, setReviewId] = useState<string | null>(null)

  const fetchTemplates = () => {
    setIsLoading(true)
    fetch(`/api/tenant/${tenantSlug}/website-templates`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) setTemplates(data.templates)
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

  const schemaOptions = useMemo(
    () => Array.from(new Map(templates.map((t) => [t.schemaTemplate.slug, t.schemaTemplate.name])).entries()),
    [templates],
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
    const filtered = schemaFilter === ALL_SCHEMAS ? templates : templates.filter((t) => t.schemaTemplate.slug === schemaFilter)

    return (
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground max-w-lg">
          Website Template dibuat lewat ChatGPT/IDE yang terhubung ke MCP SaCMS Global (<code className="font-mono">create_website_template</code>) — tidak ada form di sini. <strong>Publish</strong> membuatnya terlihat di semua workspace.
        </p>

        <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex-row items-center justify-between gap-3 flex-wrap space-y-0">
            <CardTitle className="text-sm font-bold text-foreground">Daftar Website Template ({filtered.length})</CardTitle>
            {schemaOptions.length > 0 && <SchemaFilterSelect />}
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <LayoutTemplate className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-bold text-xs text-foreground">Belum ada Website Template</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Buat lewat MCP SaCMS Global (<code className="font-mono">create_website_template</code>).</p>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              className="h-7 w-7 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                              title={`Buka Demo: ${t.demoUrl}`}
                            >
                              <a href={t.demoUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
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
  const visibleTemplates = schemaFilter === ALL_SCHEMAS ? published : published.filter((t) => t.schemaTemplate.slug === schemaFilter)

  if (published.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
        <LayoutTemplate className="h-6 w-6 opacity-50" />
        <p className="text-xs">Belum ada Website Template tersedia.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20 flex-row items-center justify-between gap-3 flex-wrap space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-sm font-bold text-foreground">Galeri Website Template ({visibleTemplates.length})</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Frontend siap pakai dari tim SaCMS — klik <strong>Pratinjau</strong> untuk melihat file dan skema yang dipakai, lalu <strong>Terapkan</strong> kalau sudah sesuai.
            </p>
          </div>
          {schemaOptions.length > 0 && <SchemaFilterSelect />}
        </CardHeader>
        <CardContent className="p-0">
          {visibleTemplates.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <LayoutTemplate className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="font-bold text-xs text-foreground">Tidak ada Website Template untuk Schema Template ini</p>
            </div>
          ) : (
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewId(t.id)}
                        className="h-7 rounded-lg text-[11px] font-bold gap-1.5"
                      >
                        <Eye className="h-3 w-3" /> Pratinjau
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WebsiteTemplateReviewDialog
        open={!!reviewId}
        onOpenChange={(open) => !open && setReviewId(null)}
        tenantSlug={tenantSlug}
        websiteTemplateId={reviewId}
        isGlobal={false}
        onApplied={() => onApplied?.()}
      />
    </div>
  )
}
