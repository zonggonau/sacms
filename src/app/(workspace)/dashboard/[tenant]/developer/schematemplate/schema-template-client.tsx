"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, ArrowLeft, LayoutTemplate, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { SchemaStep } from "../aischema/schema-step"

interface SchemaTemplateItem {
  id: string
  name: string
  slug: string
  category: string
  icon: string
  description: string | null
  published: boolean
  createdAt: string
}

export function SchemaTemplateClient({ tenantSlug }: { tenantSlug: string }) {
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [view, setView] = useState<"list" | "author">("list")
  const [templates, setTemplates] = useState<SchemaTemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates`)
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      toast({ variant: "destructive", title: "Gagal Memuat", description: "Gagal memuat daftar Schema Template." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

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
          ? `"${template.name}" sekarang terlihat oleh semua workspace.`
          : `"${template.name}" disembunyikan dari galeri template.`,
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
        description: `"${template.name}" akan dihapus permanen. Tenant yang sudah pernah import tidak terpengaruh.`,
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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })

  if (view === "author") {
    return (
      <div className="flex flex-col h-full min-h-0 gap-4 w-full max-w-full">
        <button
          type="button"
          onClick={() => setView("list")}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer shrink-0"
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

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 w-full max-w-full">
      {confirmDialog}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <LayoutTemplate className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Schema Template</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              SaCMS Global
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Buat skema siap pakai (mis. Website Desa, Website Cafe) dan publish agar bisa diimport workspace lain lewat AI Schema Generator mereka.
          </p>
        </div>
        <Button onClick={() => setView("author")} className="h-9 gap-1.5 font-bold text-xs rounded-xl shadow-xs shrink-0">
          <Plus className="h-3.5 w-3.5" /> Buat Template Baru
        </Button>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground">Daftar Template ({templates.length})</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Template yang di-publish langsung muncul di Galeri Template semua workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat template...
            </div>
          ) : templates.length === 0 ? (
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
