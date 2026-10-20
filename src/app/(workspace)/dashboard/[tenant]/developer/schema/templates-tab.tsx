"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, LayoutTemplate, Sparkles, Plus, Trash2, Pencil, ArrowLeft } from "lucide-react"
import type { SchemaExport } from "@/components/ai-builder/schema-diagram"
import { SchemaStep } from "./schema-step"

interface SchemaTemplateItem {
  id: string
  name: string
  slug: string
  category: string
  icon: string
  description: string | null
  published: boolean
  createdAt?: string
  schema: SchemaExport
}

interface TemplatesTabProps {
  tenantSlug: string
  /** SaCMS Global workspace gets the full author/publish/delete management view instead of the plain browse-and-use grid — publishing is restricted to super admin / SaCMS staff, enforced server-side by the same access.isGlobal gate the schema-templates API already uses. */
  isGlobal: boolean
  /** Loads the template's schema into the preview (Diagram tab) — does NOT touch the real workspace schema until the user explicitly confirms. */
  onUseTemplate: (template: { name: string; schema: SchemaExport }) => void
}

export function TemplatesTab({ tenantSlug, isGlobal, onUseTemplate }: TemplatesTabProps) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [view, setView] = useState<"list" | "author">("list")
  const [templates, setTemplates] = useState<SchemaTemplateItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fetchTemplates = () => {
    setIsLoading(true)
    fetch(`/api/tenant/${tenantSlug}/schema-templates`)
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

  const handleTogglePublish = async (template: SchemaTemplateItem) => {
    setPendingId(template.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !template.published }),
      })
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal mengubah status publish")
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, published: !t.published } : t)))
      toast({
        title: !template.published ? "Template Dipublish" : "Template Ditarik",
        description: !template.published
          ? `"${template.name}" sekarang terlihat di tab Template semua workspace.`
          : `"${template.name}" disembunyikan dari tab Template.`,
      })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setPendingId(null)
    }
  }

  const handleDelete = async (template: SchemaTemplateItem) => {
    if (
      !(await confirm({
        title: "Hapus template ini?",
        description: `"${template.name}" akan dihapus permanen. Workspace yang sudah pernah import tidak terpengaruh.`,
        confirmLabel: "Hapus Template",
        variant: "destructive",
      }))
    )
      return

    setPendingId(template.id)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates/${template.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal menghapus template")
      setTemplates((prev) => prev.filter((t) => t.id !== template.id))
      toast({ title: "Template Dihapus", description: `"${template.name}" telah dihapus.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
    } finally {
      setPendingId(null)
    }
  }

  if (view === "author") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-3 w-3" /> Kembali ke Daftar Template
        </button>
        <SchemaStep
          tenantSlug={tenantSlug}
          hasSchema={false}
          existingSchemaSummary={{ contentTypes: [], singleTypes: [] }}
          mode="template"
          onSchemaReady={() => {
            fetchTemplates()
            setView("list")
          }}
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat template...
      </div>
    )
  }

  // ── SaCMS Global: full author / publish / delete management table ──
  if (isGlobal) {
    const formatDate = (iso?: string) =>
      iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"

    return (
      <div className="space-y-3">
        {confirmDialog}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-muted-foreground max-w-lg">
            Template yang di-<strong>Publish</strong> langsung terlihat di tab Template semua workspace dan bisa dipakai lewat AI Schema Generator mereka. Publish hanya bisa dilakukan dari sini (SaCMS Global) oleh super admin / tim SaCMS.
          </p>
          <Button onClick={() => setView("author")} className="h-8 gap-1.5 font-bold text-xs rounded-xl shrink-0">
            <Plus className="h-3.5 w-3.5" /> Buat Template Baru
          </Button>
        </div>

        <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
          <CardHeader className="p-4 pb-3 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-bold text-foreground">Daftar Template ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {templates.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <LayoutTemplate className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-bold text-xs text-foreground">Belum ada template</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Klik <strong>Buat Template Baru</strong> untuk mulai.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/60">
                  <TableRow>
                    <TableHead className="font-bold text-xs pl-6">Template</TableHead>
                    <TableHead className="font-bold text-xs">Kategori</TableHead>
                    <TableHead className="font-bold text-xs">Dibuat</TableHead>
                    <TableHead className="font-bold text-xs">Publish</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-xs">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
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
                        <Badge variant="outline" className="text-[10px] font-bold">{t.category}</Badge>
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
                          <Link href={`/dashboard/${tenantSlug}/developer/schema/templates/${t.id}/edit`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                              title="Edit Detail Schema"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(t)}
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
      </div>
    )
  }

  // ── Regular tenant: browse & use grid (published templates only) ──
  const visibleTemplates = templates.filter((t) => t.published)

  if (visibleTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
        <LayoutTemplate className="h-6 w-6 opacity-50" />
        <p className="text-xs">Belum ada template tersedia.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Dibuat tim SaCMS — klik <strong>Pakai Template</strong> untuk memuatnya sebagai preview di tab Diagram Schema, lalu konfirmasi kalau sudah sesuai.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleTemplates.map((t) => {
          const totalModels =
            (t.schema.contentTypes?.length || 0) + (t.schema.singleTypes?.length || 0) + (t.schema.components?.length || 0)
          return (
            <Card key={t.id} className="border-border/70 flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div className="min-w-0">
                    <CardTitle className="text-sm font-bold truncate">{t.name}</CardTitle>
                    <Badge variant="outline" className="text-[9px] font-bold mt-0.5 border-primary/20 text-primary">{t.category}</Badge>
                  </div>
                </div>
                {t.description && <CardDescription className="text-xs line-clamp-2">{t.description}</CardDescription>}
              </CardHeader>
              <CardContent className="pt-0 flex-1">
                <p className="text-[11px] text-muted-foreground">{totalModels} struktur data (Content Type, Single Type, Component)</p>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  size="sm"
                  onClick={() => onUseTemplate({ name: t.name, schema: t.schema })}
                  className="h-8 w-full rounded-xl text-xs font-bold gap-1.5"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Pakai Template
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
