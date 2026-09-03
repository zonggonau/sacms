"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, Search, Filter,
  CheckSquare, Square, Download, MoreHorizontal, ImageIcon, AlertCircle,
  Check, Layers, Sparkles, Code2, LayoutGrid, Table2, Kanban,
  Columns, ChevronDown, X, Link2, FileDown, Loader2
} from "lucide-react"
import { ApiSnippetDialog } from "@/components/cms/api-snippet-dialog"
import { ContentKanbanBoard } from "@/components/cms/content-kanban-board"
import { ColumnSettingsModal } from "@/components/cms/column-settings-modal"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { 
  bulkContentAction, 
  deleteEntryAction, 
  updateContentEntryStatusAction 
} from "@/actions/content"
import { extractEntryLabel, extractEntrySubtitle, RelationLabelItem } from "@/lib/relation-labels"
import { allowedUserTransitions, isWorkflowStatus, WorkflowStatus } from "@/lib/content-workflow-rules"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",      color: "bg-muted text-muted-foreground border-border/80", icon: FileText },
  IN_REVIEW: { label: "In Review",  color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Clock },
  APPROVED:  { label: "Approved",   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Clock },
  PUBLISHED: { label: "Published",  color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", icon: Archive },
  REJECTED:  { label: "Rejected",   color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: AlertCircle },
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')
}

export function ContentEntriesManager({ 
  contentType, 
  initialEntries,
  initialRelationLabels = {},
  relatedSchemas = {},
  tenantSlug,
  contentTypeSlug,
  isLimitReached = false,
  limit = 0,
  currentCount = 0,
  basePath,
  userRole = "owner",
  customPermissions = null,
}: { 
  contentType: any, 
  initialEntries: any[],
  initialRelationLabels?: Record<string, RelationLabelItem>,
  relatedSchemas?: Record<string, { name: string; slug: string; fields: any[] }>,
  tenantSlug: string,
  contentTypeSlug: string,
  isLimitReached?: boolean,
  limit?: number,
  currentCount?: number,
  basePath?: string,
  userRole?: string,
  customPermissions?: string[] | null,
}) {
  const router = useRouter()
  const navBasePath = basePath || `/dashboard/${tenantSlug}/cms`
  
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchTargetField, setSearchTargetField] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string[]>(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED", "APPROVED", "SCHEDULED", "REJECTED"])
  const [isApiSnippetOpen, setIsApiSnippetOpen] = useState(false)
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table")
  const [relationLabelsMap, setRelationLabelsMap] = useState<Record<string, RelationLabelItem>>(initialRelationLabels)

  // Default visible columns: first 4 fields
  const defaultColumns = useMemo(() => {
    const fields = contentType?.fields || []
    const keys = fields.slice(0, 4).map((f: any) => f.slug)
    return keys.length > 0 ? keys : ["id"]
  }, [contentType])

  const storageKey = `sacms_cols_${tenantSlug}_${contentTypeSlug}`

  // Load visible columns from localStorage or use defaults
  const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumns)
  const [downloadingDocxId, setDownloadingDocxId] = useState<string | null>(null)

  // Check if content type has active document/docx template plugin
  const hasDocxTemplate = useMemo(() => {
    if (contentType?.docxTemplateUrl) return true
    if (contentType?.fields?.some((f: any) => f.type === "document_template")) return true
    return false
  }, [contentType])

  const handleDownloadDocx = async (entryId: string, entryTitle?: string) => {
    try {
      setDownloadingDocxId(entryId)
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entryId}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Gagal mengunduh berkas surat")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const safeTitle = entryTitle ? `_${String(entryTitle).replace(/[^a-zA-Z0-9_-]/g, "_")}` : ""
      a.download = `${contentTypeSlug}${safeTitle}.docx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Surat Berhasil Diunduh",
        description: "Berkas Word (.docx) dengan data terisi telah siap.",
      })
    } catch (err: any) {
      toast({
        title: "Gagal Mengunduh Surat",
        description: err.message || "Terjadi kesalahan saat memproses template surat.",
        variant: "destructive",
      })
    } finally {
      setDownloadingDocxId(null)
    }
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleColumns(parsed)
        }
      }
    } catch {}
  }, [storageKey])

  const handleSaveVisibleColumns = (cols: string[]) => {
    setVisibleColumns(cols)
    try {
      localStorage.setItem(storageKey, JSON.stringify(cols))
      toast({ title: "Pengaturan Kolom Disimpan", description: `${cols.length} kolom aktif dipilih.` })
    } catch {}
  }

  const handleResetDefaultColumns = () => {
    setVisibleColumns(defaultColumns)
    try {
      localStorage.removeItem(storageKey)
      toast({ title: "Kolom Direset ke Bawaan" })
    } catch {}
  }

  // Load preferred view mode from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sacms_cms_view_mode")
      if (saved === "table" || saved === "kanban") {
        setViewMode(saved)
      }
    } catch {}
  }, [])

  const handleViewModeChange = (mode: "table" | "kanban") => {
    setViewMode(mode)
    try {
      localStorage.setItem("sacms_cms_view_mode", mode)
    } catch {}
  }

  // Available search target options
  const searchOptions = useMemo(() => {
    const opts = [{ value: "all", label: "Semua Kolom" }]
    const fields = contentType?.fields || []
    for (const f of fields) {
      opts.push({ value: f.slug, label: f.name })
      // If relation, also add sub-fields
      const targetSlug = f.relationSlug || f.options?.targetSlug
      const relSchema = targetSlug ? relatedSchemas[targetSlug] : null
      if (relSchema && relSchema.fields?.length > 0) {
        for (const rf of relSchema.fields) {
          opts.push({
            value: `${f.slug}.${rf.slug}`,
            label: `${f.name} ➔ ${rf.name}`
          })
        }
      }
    }
    return opts
  }, [contentType, relatedSchemas])

  // Filtered entries by query, target field, and workflow status
  const filteredEntries = useMemo(() => {
    return initialEntries.filter(entry => {
      const data = entry.data || {}
      const matchesStatus = statusFilter.includes(entry.status)
      if (!matchesStatus) return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()

      if (searchTargetField === "all") {
        // Search in main label/title
        const mainLabel = extractEntryLabel(data, entry.id).toLowerCase()
        if (mainLabel.includes(q)) return true
        if (entry.id.toLowerCase().includes(q)) return true

        // Search in all entry.data string values
        for (const [key, val] of Object.entries(data)) {
          if (val && typeof val === "string" && val.toLowerCase().includes(q)) return true
          if (Array.isArray(val) && val.some(item => typeof item === "string" && item.toLowerCase().includes(q))) return true
          // If val matches a relation label
          if (typeof val === "string" && relationLabelsMap[val]) {
            const relItem = relationLabelsMap[val]
            if (relItem.label.toLowerCase().includes(q)) return true
            if (relItem.subtitle && relItem.subtitle.toLowerCase().includes(q)) return true
            if (relItem.data) {
              for (const rVal of Object.values(relItem.data)) {
                if (typeof rVal === "string" && rVal.toLowerCase().includes(q)) return true
              }
            }
          }
        }
        return false
      } else {
        // Targeted Field Search
        if (searchTargetField.includes(".")) {
          const [relSlug, subSlug] = searchTargetField.split(".")
          const relId = data[relSlug]
          if (relId) {
            const ids = Array.isArray(relId) ? relId : [relId]
            return ids.some(id => {
              const relData = relationLabelsMap[id]?.data
              if (relData && relData[subSlug]) {
                return String(relData[subSlug]).toLowerCase().includes(q)
              }
              return false
            })
          }
          return false
        } else {
          const val = data[searchTargetField]
          if (val === undefined || val === null) return false
          if (typeof val === "string") {
            if (val.toLowerCase().includes(q)) return true
            if (relationLabelsMap[val]?.label.toLowerCase().includes(q)) return true
            if (relationLabelsMap[val]?.subtitle?.toLowerCase().includes(q)) return true
          } else if (Array.isArray(val)) {
            return val.some(item => {
              if (typeof item === "string") {
                if (item.toLowerCase().includes(q)) return true
                if (relationLabelsMap[item]?.label.toLowerCase().includes(q)) return true
              }
              return false
            })
          } else {
            return String(val).toLowerCase().includes(q)
          }
          return false
        }
      }
    })
  }, [initialEntries, searchQuery, searchTargetField, statusFilter, relationLabelsMap])

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEntries.map(e => e.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(item => item !== id))
    } else {
      setSelectedIds([...selectedIds, id])
    }
  }

  const handleBulkAction = async (action: "publish" | "draft" | "archive" | "delete") => {
    if (selectedIds.length === 0) return
    if (
      action === "delete" &&
      !(await confirm({
        title: `Hapus ${selectedIds.length} entri terpilih?`,
        description: "Entri akan dihapus secara permanen.",
        confirmLabel: "Hapus entri",
        variant: "destructive",
      }))
    ) {
      return
    }

    try {
      const res = await bulkContentAction(tenantSlug, contentTypeSlug, selectedIds, action)
      if (res.success) {
        toast({ title: "Aksi Massal Berhasil", description: `${selectedIds.length} entri telah diproses.` })
        setSelectedIds([])
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Aksi Gagal", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memproses aksi massal" })
    }
  }

  const handleDeleteEntry = async (id: string) => {
    if (
      !(await confirm({
        title: "Hapus entri konten ini?",
        confirmLabel: "Hapus entri",
        variant: "destructive",
      }))
    )
      return
    try {
      const res = await deleteEntryAction(id, tenantSlug, contentTypeSlug)
      if (res.success) {
        toast({ title: "Entri Dihapus" })
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menghapus entri" })
    }
  }

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await updateContentEntryStatusAction(tenantSlug, contentTypeSlug, entryId, newStatus)
      if ("entry" in res && res.entry) {
        toast({ title: "Status Diperbarui", description: `Entri dipindahkan ke status ${newStatus}` })
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Mengubah Status", description: "error" in res ? (res as any).error : "Gagal mengubah status" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memperbarui status entri" })
    }
  }

  // Resolve column header title
  const getColumnHeader = (colKey: string): string => {
    if (colKey.includes(".")) {
      const [relSlug, subSlug] = colKey.split(".")
      const relField = contentType?.fields.find((f: any) => f.slug === relSlug)
      const targetSlug = relField?.relationSlug || relField?.options?.targetSlug
      const relSchema = targetSlug ? relatedSchemas[targetSlug] : null
      const subField = relSchema?.fields.find((f: any) => f.slug === subSlug)
      return `${relField?.name || relSlug} ➔ ${subField?.name || subSlug}`
    }
    const field = contentType?.fields.find((f: any) => f.slug === colKey)
    return field?.name || colKey
  }

  const canCreateEntry = userRole !== "subscriber" && userRole !== "viewer"
  const canDeleteEntry = userRole !== "subscriber" && userRole !== "viewer"

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
      <ApiSnippetDialog
        open={isApiSnippetOpen} 
        onOpenChange={setIsApiSnippetOpen} 
        tenantSlug={tenantSlug} 
        contentTypeSlug={contentTypeSlug} 
        contentTypeName={contentType?.name}
        fields={contentType?.fields}
      />

      <ColumnSettingsModal
        isOpen={isColumnModalOpen}
        onOpenChange={setIsColumnModalOpen}
        contentType={contentType}
        relatedSchemas={relatedSchemas}
        visibleColumns={visibleColumns}
        onChangeVisibleColumns={handleSaveVisibleColumns}
        onResetDefault={handleResetDefaultColumns}
      />

      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-border/80 hover:bg-muted shrink-0" 
                onClick={() => router.push(navBasePath)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                    {contentType?.name || "Entri Konten"}
                  </h1>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-md font-semibold">
                    {filteredEntries.length} Entri
                  </Badge>
                  {hasDocxTemplate && (
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-md gap-1 px-2 py-0.5 shadow-2xs">
                      <FileText className="h-3 w-3" /> Format Surat Aktif
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kelola dan publikasikan entri data untuk model koleksi <code className="font-mono font-bold text-foreground">{contentTypeSlug}</code>.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsApiSnippetOpen(true)}
                className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80 text-muted-foreground hover:text-foreground"
              >
                <Code2 className="mr-1.5 h-3.5 w-3.5 text-primary" /> API Snippet
              </Button>

              {canCreateEntry && (
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs shrink-0" 
                  onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/new`)}
                  disabled={isLimitReached}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Entri Baru
                </Button>
              )}
            </div>
          </div>

          {/* Limit Reached Warning Banner */}
          {isLimitReached && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div className="font-medium">
                Workspace Anda telah mencapai batas kuota entri konten ({limit} entri). Hapus entri lama atau tingkatkan paket langganan untuk menambah entri baru.
              </div>
            </div>
          )}

          {/* Search, Targeted Search, Filter & Toolbar Bar */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              
              {/* Left Toolbar: Targeted Search & Status Filter */}
              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-2xl">
                
                {/* Search Target Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-9 rounded-xl border-border/80 text-xs font-bold shrink-0 bg-muted/20 hover:bg-muted/40 gap-1.5 max-w-[200px]"
                    >
                      <span className="text-muted-foreground font-normal text-[11px]">Cari di:</span>
                      <span className="truncate text-foreground font-bold">
                        {searchOptions.find(o => o.value === searchTargetField)?.label || "Semua Kolom"}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto rounded-xl border-border bg-card shadow-lg">
                    <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Target Field Pencarian</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup value={searchTargetField} onValueChange={setSearchTargetField}>
                      {searchOptions.map((opt) => (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value} className="text-xs font-medium cursor-pointer rounded-lg">
                          {opt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder={`Cari ${searchTargetField === 'all' ? 'semua data' : searchOptions.find(o => o.value === searchTargetField)?.label || 'data'}...`} 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-9 bg-muted/30 border-border/80 rounded-xl text-xs"
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/80 text-xs font-bold shrink-0">
                      <Filter className="h-3.5 w-3.5 mr-1.5" /> Status ({statusFilter.length})
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border bg-card shadow-xs">
                    {Object.keys(STATUS_CONFIG).map(s => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={statusFilter.includes(s)}
                        onCheckedChange={(checked) => {
                          setStatusFilter(prev => checked ? [...prev, s] : prev.filter(i => i !== s))
                        }}
                        className="text-xs font-medium rounded-lg"
                      >
                        {STATUS_CONFIG[s].label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Right Toolbar: Column Configurator, View Switcher & Bulk Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Bulk Actions (When Items Selected) */}
                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-1.5 p-1 px-2.5 bg-muted/60 rounded-xl border border-border/80 animate-in fade-in">
                    <span className="text-[11px] font-bold text-foreground mr-1.5">
                      {selectedIds.length} Terpilih
                    </span>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs font-bold rounded-lg" 
                      onClick={() => handleBulkAction('publish')}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Publish
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs font-bold rounded-lg" 
                      onClick={() => handleBulkAction('draft')}
                    >
                      <FileText className="h-3 w-3 mr-1 text-muted-foreground" /> Draft
                    </Button>
                    <Separator orientation="vertical" className="h-4 bg-border" />
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg" 
                      onClick={() => handleBulkAction('delete')}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Hapus
                    </Button>
                  </div>
                )}

                {/* Column Visibility Manager Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColumnModalOpen(true)}
                  className="h-9 px-3 rounded-xl border-border/80 text-xs font-bold shadow-xs hover:bg-muted/40 flex items-center gap-1.5"
                  title="Atur kolom utama dan relasi yang ditampilkan pada tabel"
                >
                  <Columns className="h-3.5 w-3.5 text-primary" />
                  <span>Atur Kolom</span>
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 rounded-md ml-0.5">
                    {visibleColumns.length}
                  </Badge>
                </Button>

                {/* View Mode Switcher (Table vs Kanban) */}
                <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border/80 shadow-xs gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 rounded-lg text-xs font-bold transition-all gap-1.5 border-none",
                      viewMode === "table" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => handleViewModeChange("table")}
                    title="Tampilan Tabel Data"
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Tabel</span>
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 px-2.5 rounded-lg text-xs font-bold transition-all gap-1.5 border-none",
                      viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => handleViewModeChange("kanban")}
                    title="Tampilan Papan Kanban (Trello-style)"
                  >
                    <Kanban className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Kanban</span>
                  </Button>
                </div>
              </div>

            </div>
          </Card>

          {/* Conditional View: Kanban Board vs Table */}
          {viewMode === "kanban" ? (
            <div className="pt-1 animate-in fade-in duration-200">
              <ContentKanbanBoard
                entries={filteredEntries}
                tenantSlug={tenantSlug}
                contentTypeSlug={contentTypeSlug}
                userRole={userRole}
                customPermissions={customPermissions}
                navBasePath={navBasePath}
                onStatusChange={() => router.refresh()}
                onDeleteEntry={() => router.refresh()}
              />
            </div>
          ) : (
          <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card animate-in fade-in duration-200">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/20 border-b border-border/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px] pl-5">
                      <button onClick={handleToggleSelectAll} className="focus:outline-none cursor-pointer flex items-center justify-center">
                        {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>

                    {/* Dynamic Visible Columns Header */}
                    {visibleColumns.map((colKey) => (
                      <TableHead key={colKey} className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3 whitespace-nowrap">
                        {getColumnHeader(colKey)}
                      </TableHead>
                    ))}

                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-center py-3">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Terakhir Diubah</TableHead>
                    <TableHead className="text-right pr-5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + 4} className="text-center py-20 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center border border-border/60">
                            <Search className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="font-bold text-xs text-foreground mt-1">Tidak ada entri data yang cocok</p>
                          <p className="text-[11px] text-muted-foreground">
                            {searchQuery ? `Tidak ada hasil untuk kata kunci "${searchQuery}" pada filter ${searchOptions.find(o => o.value === searchTargetField)?.label}.` : "Belum ada entri konten yang tersedia."}
                          </p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-primary text-xs font-bold mt-1" 
                            onClick={() => { setSearchQuery(""); setSearchTargetField("all"); setStatusFilter(Object.keys(STATUS_CONFIG)) }}
                          >
                            Reset Filter Pencarian
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => {
                      const data = entry.data || {}
                      const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                      const StatusIcon = statusCfg.icon
                      
                      return (
                        <TableRow 
                          key={entry.id} 
                          className={cn(
                            "group hover:bg-muted/20 transition-colors border-b border-border/60 last:border-b-0",
                            selectedIds.includes(entry.id) && "bg-muted/30"
                          )}
                        >
                          <TableCell className="pl-5">
                            <button onClick={() => handleToggleSelect(entry.id)} className="focus:outline-none cursor-pointer flex items-center justify-center">
                              {selectedIds.includes(entry.id) ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100" />
                              )}
                            </button>
                          </TableCell>
                          
                          {/* Dynamic Cells Rendering */}
                          {visibleColumns.map((colKey, colIdx) => {
                            if (colKey.includes(".")) {
                              // Nested Relation Field (e.g. "pejabat.jabatan")
                              const [relSlug, subSlug] = colKey.split(".")
                              const relId = data[relSlug]
                              const ids = Array.isArray(relId) ? relId : (relId ? [relId] : [])

                              if (ids.length === 0) {
                                return (
                                  <TableCell key={colKey} className="py-3 text-xs text-muted-foreground">
                                    -
                                  </TableCell>
                                )
                              }

                              return (
                                <TableCell key={colKey} className="py-3 text-xs">
                                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                                    {ids.map((id: string, i: number) => {
                                      const relData = relationLabelsMap[id]?.data
                                      const subVal = relData ? relData[subSlug] : undefined
                                      return (
                                        <span key={i} className="font-medium text-foreground">
                                          {subVal !== undefined && subVal !== null ? String(subVal) : "-"}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </TableCell>
                              )
                            }

                            // Primary Field Column
                            const field = contentType?.fields.find((f: any) => f.slug === colKey)
                            const val = data[colKey]
                            const fieldType = (field?.type || "").toLowerCase()
                            const isMedia = ['media', 'image', 'file', 'mediamultiple', 'gallery', 'picture'].includes(fieldType)
                            const isRichText = ['richtext', 'textarea', 'markdown', 'longtext'].includes(fieldType)
                            const isRelation = fieldType === 'relation' || !!field?.relationSlug || (typeof val === 'string' && !!relationLabelsMap[val])

                            return (
                              <TableCell key={colKey} className="py-3 text-xs">
                                {isMedia ? (
                                  <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden border border-border/80">
                                    {val ? (
                                      <img 
                                        src={Array.isArray(val) ? val[0] : String(val)} 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "";
                                          (e.target as HTMLImageElement).className = "hidden";
                                        }}
                                      />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                                    )}
                                  </div>
                                ) : isRelation ? (
                                  (() => {
                                    const ids = Array.isArray(val) ? val : (val ? [val] : [])
                                    if (ids.length === 0) return <span className="text-muted-foreground">-</span>

                                    return (
                                      <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                        {ids.map((id: string, idx: number) => {
                                          const item = relationLabelsMap[id]
                                          const label = item?.label || (id.length > 12 ? id.substring(0, 8) : id)
                                          const sub = item?.subtitle

                                          return (
                                            <Badge 
                                              key={idx} 
                                              variant="secondary" 
                                              className="text-xs font-bold py-0.5 px-2.5 bg-muted/50 hover:bg-muted/80 border border-border/80 text-foreground inline-flex items-center gap-1 rounded-lg shadow-2xs"
                                            >
                                              <span>{label}</span>
                                              {sub && (
                                                <span className="text-[10px] text-muted-foreground font-normal ml-0.5 opacity-80">
                                                  • {sub}
                                                </span>
                                              )}
                                            </Badge>
                                          )
                                        })}
                                      </div>
                                    )
                                  })()
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-foreground truncate max-w-[240px]">
                                      {val ? (isRichText ? stripHtml(String(val)) : String(val)) : "-"}
                                    </span>
                                    {colIdx === 0 && (
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        ID: {entry.id.substring(0, 10)}...
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )
                          })}

                          {/* Status Badge with Quick Workflow Switcher */}
                          <TableCell className="text-center py-3">
                            {(() => {
                              const nextStatuses = isWorkflowStatus(entry.status) 
                                ? allowedUserTransitions(entry.status as WorkflowStatus, userRole, customPermissions)
                                : []

                              if (nextStatuses.length === 0) {
                                return (
                                  <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-none", statusCfg.color)}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusCfg.label}
                                  </Badge>
                                )
                              }

                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button 
                                      className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer shadow-2xs hover:opacity-80",
                                        statusCfg.color
                                      )}
                                      title="Klik untuk mengubah status workflow"
                                    >
                                      <StatusIcon className="h-3 w-3" />
                                      {statusCfg.label}
                                      <ChevronDown className="h-2.5 w-2.5 opacity-60 ml-0.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="w-44 rounded-xl border-border bg-card shadow-lg p-1">
                                    <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                                      Transisi Status
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {nextStatuses.map((st) => {
                                      const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.DRAFT
                                      const Icon = cfg.icon
                                      return (
                                        <DropdownMenuItem 
                                          key={st}
                                          onClick={() => handleStatusChange(entry.id, st)}
                                          className="text-xs font-bold py-1.5 rounded-lg cursor-pointer"
                                        >
                                          <Icon className="mr-2 h-3.5 w-3.5" />
                                          {cfg.label}
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )
                            })()}
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell className="py-3">
                            <div className="flex flex-col text-xs" suppressHydrationWarning>
                              <span className="font-semibold text-foreground" suppressHydrationWarning>
                                {new Date(entry.updatedAt).toLocaleDateString('id-ID')}
                              </span>
                              <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                                {new Date(entry.updatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-5 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {hasDocxTemplate && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 px-2.5 rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-bold gap-1.5 shadow-2xs transition-all"
                                  onClick={() => handleDownloadDocx(entry.id, entry.data?.nama || entry.data?.nama_pemohon || entry.data?.title || entry.data?.judul || entry.data?.nomor_surat)}
                                  disabled={downloadingDocxId === entry.id}
                                  title="Download Surat Word (.docx) dengan data terisi"
                                >
                                  {downloadingDocxId === entry.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <FileDown className="h-3.5 w-3.5" />
                                  )}
                                  <span className="hidden md:inline">Download Surat</span>
                                </Button>
                              )}

                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                                onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${entry.id}`)}
                                title="Edit Entri"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 rounded-xl border-border bg-card shadow-lg p-1">
                                  {hasDocxTemplate && (
                                    <DropdownMenuItem 
                                      className="text-xs font-bold text-primary focus:text-primary rounded-lg cursor-pointer gap-2 py-1.5"
                                      onClick={() => handleDownloadDocx(entry.id, entry.data?.nama || entry.data?.nama_pemohon || entry.data?.title || entry.data?.judul || entry.data?.nomor_surat)}
                                    >
                                      <FileDown className="h-3.5 w-3.5" /> Download Surat (.docx)
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuItem 
                                    className="text-xs font-medium rounded-lg cursor-pointer gap-2 py-1.5"
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(entry.data, null, 2))
                                      toast({ title: "JSON Disalin ke Clipboard" })
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" /> Salin JSON
                                  </DropdownMenuItem>
                                  
                                  {canDeleteEntry && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-red-600 focus:text-red-700 font-bold text-xs rounded-lg hover:bg-red-500/10 cursor-pointer gap-2 py-1.5" 
                                        onClick={() => handleDeleteEntry(entry.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" /> Hapus Entri
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          )}

        </div>
      </div>
    </div>
  )
}
