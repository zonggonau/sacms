"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, Search, Filter,
  CheckSquare, Square, Download, MoreHorizontal, ImageIcon, AlertCircle,
  Check, Layers, Sparkles, LayoutGrid, Table2, Kanban,
  Columns, ChevronDown, X, Link2, FileDown, Loader2,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, CalendarRange, FileSpreadsheet, RotateCcw,
  ListFilter, User
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select as UiSelect,
  SelectContent as UiSelectContent,
  SelectItem as UiSelectItem,
  SelectTrigger as UiSelectTrigger,
  SelectValue as UiSelectValue,
} from "@/components/ui/select"
import { ContentKanbanBoard } from "@/components/cms/content-kanban-board"
import { ContentCalendarView } from "@/components/cms/content-calendar-view"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { copyToClipboard } from "@/lib/clipboard"
import {
  bulkContentAction,
  deleteEntryAction,
  updateContentEntryStatusAction,
  getEntriesAction,
  duplicateEntryAction,
  restoreEntryAction,
  permanentlyDeleteEntryAction,
} from "@/actions/content"
import { extractEntryLabel, extractEntrySubtitle, RelationLabelItem } from "@/lib/relation-labels"
import { allowedUserTransitions, CONTENT_STATUSES, isWorkflowStatus, WorkflowStatus } from "@/lib/content-workflow-rules"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",      color: "bg-muted text-muted-foreground border-border/80", icon: FileText },
  IN_REVIEW: { label: "In Review",  color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Clock },
  APPROVED:  { label: "Approved",   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Clock },
  PUBLISHED: { label: "Published",  color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   color: "bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20", icon: Archive },
  REJECTED:  { label: "Rejected",   color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: AlertCircle },
}

// Mirrors TRASH_RESTORE_WINDOW_DAYS in entry-service.ts — kept as a literal
// here rather than imported since that module pulls in server-only Prisma/DB
// code that must never end up in the client bundle.
const TRASH_RESTORE_WINDOW_DAYS = 30
const ENTRIES_PAGE_SIZE = 100
const EMPTY_RELATION_LABELS: Record<string, RelationLabelItem> = {}

function entryPageForCount(count: number) {
  return Math.max(1, Math.ceil(count / ENTRIES_PAGE_SIZE))
}

function localDateBoundary(value: string, offsetDays = 0) {
  if (!value) return undefined
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return undefined
  if (offsetDays) date.setDate(date.getDate() + offsetDays)
  return date.toISOString()
}

function parseEntryData(entry: any) {
  if (typeof entry.data !== "string") return entry
  try {
    return { ...entry, data: JSON.parse(entry.data) }
  } catch {
    return { ...entry, data: {} }
  }
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')
}

export function ContentEntriesManager({
  contentType,
  initialEntries,
  initialRelationLabels = EMPTY_RELATION_LABELS,
  relatedSchemas = {},
  authors = [],
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
  authors?: { id: string; name: string | null; email: string }[],
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
  const [statusFilter, setStatusFilter] = useState<WorkflowStatus[]>([...CONTENT_STATUSES])
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "calendar">("table")
  const [relationLabelsMap, setRelationLabelsMap] = useState<Record<string, RelationLabelItem>>(initialRelationLabels)

  const [entries, setEntries] = useState<any[]>(initialEntries)
  const [entriesPage, setEntriesPage] = useState(() => entryPageForCount(initialEntries.length))
  const [hasMoreEntries, setHasMoreEntries] = useState(initialEntries.length >= 200)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [sortBy, setSortBy] = useState<"createdAt" | "updatedAt" | "status">("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isServerSearching, setIsServerSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchAttempt, setSearchAttempt] = useState(0)
  const activeQuery = useRef<{ cancelled: boolean } | null>(null)

  const [dateField, setDateField] = useState<"createdAt" | "publishedAt">("createdAt")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [authorFilter, setAuthorFilter] = useState("")
  const hasDateFilter = Boolean(dateFrom || dateTo)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const query = useMemo(() => ({
    search: debouncedSearch || undefined,
    searchField: debouncedSearch ? searchTargetField : undefined,
    statuses: statusFilter.length === CONTENT_STATUSES.length ? undefined : statusFilter,
    sortBy,
    sortOrder,
    authorId: authorFilter || undefined,
    dateField,
    dateFrom: localDateBoundary(dateFrom),
    dateBefore: localDateBoundary(dateTo, 1),
  }), [debouncedSearch, searchTargetField, statusFilter, sortBy, sortOrder, authorFilter, dateField, dateFrom, dateTo])

  useEffect(() => {
    const request = { cancelled: false }
    activeQuery.current = request
    const useInitial = !query.search && !query.statuses && !query.authorId && !query.dateFrom &&
      !query.dateBefore && query.sortBy === "createdAt" && query.sortOrder === "desc"

    setSearchError(null)
    setIsLoadingMore(false)
    setSelectedIds([])

    if (useInitial) {
      setEntries(initialEntries)
      setRelationLabelsMap(initialRelationLabels)
      setEntriesPage(entryPageForCount(initialEntries.length))
      setHasMoreEntries(initialEntries.length >= 200)
      setIsServerSearching(false)
    } else {
      setIsServerSearching(true)
      void getEntriesAction(tenantSlug, contentTypeSlug, { ...query, page: 1, pageSize: ENTRIES_PAGE_SIZE })
        .then((result) => {
          if (request.cancelled) return
          if (result.error) {
            setSearchError("Filter entri gagal dimuat.")
            return
          }
          const newEntries = (result.entries || []).map(parseEntryData)
          setEntries(newEntries)
          setRelationLabelsMap(result.relationLabels || {})
          setEntriesPage(1)
          setHasMoreEntries(newEntries.length < (result.meta?.pagination?.total ?? newEntries.length))
        })
        .catch(() => {
          if (!request.cancelled) setSearchError("Filter entri gagal dimuat.")
        })
        .finally(() => {
          if (!request.cancelled) setIsServerSearching(false)
        })
    }

    return () => { request.cancelled = true }
  }, [query, tenantSlug, contentTypeSlug, initialEntries, initialRelationLabels, searchAttempt])

  const toggleSort = (column: "createdAt" | "updatedAt" | "status") => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(column)
      setSortOrder("desc")
    }
  }

  const handleLoadMoreEntries = async () => {
    if (isLoadingMore || isServerSearching || searchError || searchQuery.trim() !== debouncedSearch) return
    const request = activeQuery.current
    if (!request || request.cancelled) return
    setIsLoadingMore(true)
    try {
      const nextPage = entriesPage + 1
      const result = await getEntriesAction(tenantSlug, contentTypeSlug, { ...query, page: nextPage, pageSize: ENTRIES_PAGE_SIZE })
      if (request.cancelled) return
      if (result.error) {
        toast({ variant: "destructive", title: "Gagal Memuat Data", description: result.error })
        return
      }

      const newEntries = (result.entries || []).map(parseEntryData)
      setEntries(prev => {
        const existingIds = new Set(prev.map((entry) => entry.id))
        return [...prev, ...newEntries.filter((entry) => !existingIds.has(entry.id))]
      })
      setRelationLabelsMap(prev => ({ ...prev, ...result.relationLabels }))
      setEntriesPage(nextPage)
      setHasMoreEntries(nextPage * ENTRIES_PAGE_SIZE < (result.meta?.pagination?.total ?? 0))
    } catch {
      if (!request.cancelled) toast({ variant: "destructive", title: "Gagal Memuat Data" })
    } finally {
      if (!request.cancelled) setIsLoadingMore(false)
    }
  }

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

  // ── Export / Import entry data (JSON) ──────────────────────────────────
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const [isExportingEntries, setIsExportingEntries] = useState(false)
  const [isImportingEntries, setIsImportingEntries] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    failed: number
    failures: Array<{ index: number; error: string }>
  } | null>(null)

  const handleExportEntries = async () => {
    setIsExportingEntries(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/export`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Gagal mengekspor data")
      }
      const payload = await res.json()

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sacms-entries-${contentTypeSlug}-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({ title: "Data Diekspor", description: `${payload.count} entri berhasil diunduh sebagai JSON.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengekspor Data", description: err.message })
    } finally {
      setIsExportingEntries(false)
    }
  }

  // Structured field types a flat CSV cell can't represent faithfully —
  // serialized as JSON text in their cell instead of being dropped, same
  // spirit as the JSON export's own fidelity concerns, but this export is
  // explicitly a flattened report/spreadsheet view, never meant to be
  // re-imported (JSON stays the only round-trip format, see entries/export
  // route.ts's own comment on this).
  const CSV_STRUCTURAL_TYPES = new Set(["relation", "component", "repeater", "media", "mediaMultiple", "file", "json"])

  function csvCell(value: unknown): string {
    const str = value === null || value === undefined ? "" : String(value)
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
    return str
  }

  const [isExportingCsv, setIsExportingCsv] = useState(false)

  const handleExportEntriesCsv = async () => {
    setIsExportingCsv(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/export`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || "Gagal mengekspor data")
      }
      const payload = await res.json()
      const fields = contentType?.fields || []

      const headers = ["id", "status", ...fields.map((f: any) => f.name || f.slug), "publishedAt", "createdAt"]
      const rows = (payload.entries || []).map((e: any) => {
        const row = [e.sourceId, e.status]
        for (const f of fields) {
          const raw = e.data?.[f.slug]
          if (CSV_STRUCTURAL_TYPES.has(f.type)) {
            row.push(raw ? JSON.stringify(raw) : "")
          } else if (f.type === "richText") {
            row.push(stripHtml(raw || ""))
          } else {
            row.push(raw ?? "")
          }
        }
        row.push(e.publishedAt || "", e.createdAt || "")
        return row
      })

      const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n")
      // BOM so Excel detects UTF-8 instead of mangling non-ASCII (e.g. Indonesian diacritics).
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `sacms-entries-${contentTypeSlug}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast({ title: "Data Diekspor", description: `${rows.length} entri berhasil diunduh sebagai CSV.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengekspor Data", description: err.message })
    } finally {
      setIsExportingCsv(false)
    }
  }

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-selecting the same file
    if (!file) return

    setIsImportingEntries(true)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      if (!parsed || !Array.isArray(parsed.entries)) {
        throw new Error("Format JSON tidak valid — berkas harus berisi { entries: [...] } (hasil dari fitur Ekspor Data)")
      }

      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: parsed.entries }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal mengimpor data")

      if (data.failed > 0) {
        setImportResult(data)
      } else {
        toast({ title: "Data Diimpor", description: `${data.imported} entri baru ditambahkan sebagai draf.` })
      }
      if (data.imported > 0) router.refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Mengimpor Data", description: err.message })
    } finally {
      setIsImportingEntries(false)
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
      if (saved === "table" || saved === "kanban" || saved === "calendar") {
        setViewMode(saved)
      }
    } catch {}
  }, [])

  const handleViewModeChange = (mode: "table" | "kanban" | "calendar") => {
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

  const filteredEntries = entries

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

  // Bulk "set field value" — scalar field types only (see bulkContentAction's
  // SCALAR_BULK_TYPES guard server-side); relations/media/components need
  // structural merging that isn't safe to mass-apply from a single value.
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [bulkEditFieldSlug, setBulkEditFieldSlug] = useState<string>("")
  const [bulkEditValue, setBulkEditValue] = useState<string>("")
  const [isBulkEditSubmitting, setIsBulkEditSubmitting] = useState(false)

  const BULK_EDITABLE_TYPES = new Set([
    "text", "textarea", "richText", "markdown", "number", "currency", "percent",
    "date", "datetime", "time", "select", "boolean", "email", "url", "phone", "uid", "rating", "color",
  ])
  const bulkEditableFields = useMemo(
    () => (contentType?.fields || []).filter((f: any) => BULK_EDITABLE_TYPES.has(f.type)),
    [contentType]
  )
  const bulkEditField = bulkEditableFields.find((f: any) => f.slug === bulkEditFieldSlug)

  const handleSubmitBulkEdit = async () => {
    if (!bulkEditField) return
    setIsBulkEditSubmitting(true)
    try {
      let value: unknown = bulkEditValue
      if (bulkEditField.type === "boolean") value = bulkEditValue === "true"
      else if (["number", "currency", "percent", "rating"].includes(bulkEditField.type)) value = Number(bulkEditValue)

      const res = await bulkContentAction(tenantSlug, contentTypeSlug, selectedIds, "setField", {
        slug: bulkEditField.slug,
        value,
      })
      if (res.success && "count" in res) {
        toast({ title: "Edit Massal Berhasil", description: `${res.count} entri diperbarui.` })
        setIsBulkEditOpen(false)
        setBulkEditFieldSlug("")
        setBulkEditValue("")
        setSelectedIds([])
        router.refresh()
      } else {
        const failedCount = "failed" in res ? res.failed : undefined
        toast({
          variant: "destructive",
          title: "Edit Massal Gagal",
          description: ("error" in res && res.error) || (failedCount ? `${failedCount} entri gagal diperbarui.` : "Gagal memproses edit massal"),
        })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal memproses edit massal" })
    } finally {
      setIsBulkEditSubmitting(false)
    }
  }

  const handleBulkAction = async (action: "publish" | "draft" | "archive" | "delete") => {
    if (selectedIds.length === 0) return
    if (
      action === "delete" &&
      !(await confirm({
        title: `Hapus ${selectedIds.length} entri terpilih?`,
        description: `Entri akan dipindahkan ke Sampah dan masih bisa dipulihkan selama ${TRASH_RESTORE_WINDOW_DAYS} hari.`,
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
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, id)
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

  const [duplicatingEntryId, setDuplicatingEntryId] = useState<string | null>(null)

  const handleDuplicateEntry = async (id: string) => {
    setDuplicatingEntryId(id)
    try {
      const res = await duplicateEntryAction(tenantSlug, contentTypeSlug, id)
      if (res.success && res.entry) {
        toast({ title: "Entri Diduplikasi", description: "Salinan baru dibuat sebagai Draft." })
        router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${res.entry.id}`)
      } else {
        toast({ variant: "destructive", title: "Gagal Menduplikasi", description: res.error })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal menduplikasi entri" })
    } finally {
      setDuplicatingEntryId(null)
    }
  }

  // ── Trash (soft-delete restore window) ───────────────────────────────────
  // "Hapus Entri" soft-deletes now (entry-service.ts's deleteContentEntry) —
  // this toggles a separate view fetching those trashed rows via the same
  // getEntriesAction, just with trashed: true, so Restore/Delete Forever has
  // somewhere to live without duplicating the pagination/search plumbing.
  const [isTrashView, setIsTrashView] = useState(false)
  const [trashedEntries, setTrashedEntries] = useState<any[]>([])
  const [isLoadingTrash, setIsLoadingTrash] = useState(false)
  const [restoringEntryId, setRestoringEntryId] = useState<string | null>(null)
  const [purgingEntryId, setPurgingEntryId] = useState<string | null>(null)

  const loadTrashedEntries = async () => {
    setIsLoadingTrash(true)
    try {
      const result = await getEntriesAction(tenantSlug, contentTypeSlug, {
        page: 1,
        pageSize: 100,
        trashed: true,
        sortBy: "updatedAt",
        sortOrder: "desc",
      })
      if ("error" in result && result.error) {
        toast({ variant: "destructive", title: "Gagal Memuat Sampah", description: result.error })
        return
      }
      setTrashedEntries((result.entries || []).map(parseEntryData))
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Memuat Sampah", description: err.message || "Terjadi kesalahan" })
    } finally {
      setIsLoadingTrash(false)
    }
  }

  const handleToggleTrashView = () => {
    const next = !isTrashView
    setIsTrashView(next)
    if (next) loadTrashedEntries()
  }

  const handleRestoreEntry = async (id: string) => {
    setRestoringEntryId(id)
    try {
      const res = await restoreEntryAction(tenantSlug, contentTypeSlug, id)
      if (res.success) {
        toast({ title: "Entri Dipulihkan", description: "Entri telah dikembalikan sebagai Draft." })
        setTrashedEntries(prev => prev.filter(e => e.id !== id))
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Memulihkan", description: res.error })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal memulihkan entri" })
    } finally {
      setRestoringEntryId(null)
    }
  }

  const handlePermanentlyDeleteEntry = async (id: string) => {
    if (
      !(await confirm({
        title: "Hapus permanen entri ini?",
        description: "Tindakan ini tidak dapat dibatalkan — entri akan dihapus selamanya.",
        confirmLabel: "Hapus Selamanya",
        variant: "destructive",
      }))
    )
      return
    setPurgingEntryId(id)
    try {
      const res = await permanentlyDeleteEntryAction(tenantSlug, contentTypeSlug, id)
      if (res.success) {
        toast({ title: "Entri Dihapus Permanen" })
        setTrashedEntries(prev => prev.filter(e => e.id !== id))
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: res.error })
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: error.message || "Gagal menghapus entri" })
    } finally {
      setPurgingEntryId(null)
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

      <Dialog open={importResult !== null} onOpenChange={(open) => { if (!open) setImportResult(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hasil Impor Data</DialogTitle>
            <DialogDescription>
              {importResult?.imported} entri ditambahkan sebagai draf. {importResult?.failed} entri gagal.
            </DialogDescription>
          </DialogHeader>
          {importResult && (
            <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
              <ul className="list-disc space-y-1 pl-5">
                {importResult.failures.map(({ index, error }) => (
                  <li key={index} className="break-words">Entri ke-{index + 1} — {error}</li>
                ))}
              </ul>
              {importResult.failed > importResult.failures.length && (
                <p className="text-muted-foreground">Ditampilkan {importResult.failures.length} kegagalan pertama.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setImportResult(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">Edit Massal ({selectedIds.length} Entri)</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pilih satu field dan nilai baru — akan diterapkan ke semua entri yang dipilih.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Field</label>
              <UiSelect value={bulkEditFieldSlug} onValueChange={setBulkEditFieldSlug}>
                <UiSelectTrigger className="h-9 rounded-xl text-xs">
                  <UiSelectValue placeholder="Pilih field..." />
                </UiSelectTrigger>
                <UiSelectContent>
                  {bulkEditableFields.map((f: any) => (
                    <UiSelectItem key={f.slug} value={f.slug} className="text-xs">{f.name}</UiSelectItem>
                  ))}
                </UiSelectContent>
              </UiSelect>
            </div>

            {bulkEditField && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Nilai Baru</label>
                {bulkEditField.type === "boolean" ? (
                  <UiSelect value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <UiSelectTrigger className="h-9 rounded-xl text-xs">
                      <UiSelectValue placeholder="Pilih nilai..." />
                    </UiSelectTrigger>
                    <UiSelectContent>
                      <UiSelectItem value="true" className="text-xs">True</UiSelectItem>
                      <UiSelectItem value="false" className="text-xs">False</UiSelectItem>
                    </UiSelectContent>
                  </UiSelect>
                ) : bulkEditField.type === "select" ? (
                  <UiSelect value={bulkEditValue} onValueChange={setBulkEditValue}>
                    <UiSelectTrigger className="h-9 rounded-xl text-xs">
                      <UiSelectValue placeholder="Pilih nilai..." />
                    </UiSelectTrigger>
                    <UiSelectContent>
                      {(bulkEditField.options?.options || bulkEditField.options || []).map((opt: string, i: number) => (
                        <UiSelectItem key={i} value={opt} className="text-xs">{opt}</UiSelectItem>
                      ))}
                    </UiSelectContent>
                  </UiSelect>
                ) : (
                  <Input
                    className="h-9 rounded-xl text-xs"
                    type={["number", "currency", "percent", "rating"].includes(bulkEditField.type) ? "number" : bulkEditField.type === "date" ? "date" : bulkEditField.type === "datetime" ? "datetime-local" : bulkEditField.type === "time" ? "time" : bulkEditField.type === "email" ? "email" : "text"}
                    value={bulkEditValue}
                    onChange={e => setBulkEditValue(e.target.value)}
                    placeholder={`Nilai baru untuk ${bulkEditField.name}...`}
                  />
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsBulkEditOpen(false)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button
              onClick={handleSubmitBulkEdit}
              disabled={!bulkEditField || isBulkEditSubmitting}
              className="rounded-xl text-xs font-bold gap-1.5"
            >
              {isBulkEditSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Terapkan ke {selectedIds.length} Entri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {canCreateEntry && (
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs shrink-0 self-start sm:self-auto"
                onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Entri Baru
              </Button>
            )}
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl border-border/80 shrink-0 bg-muted/20 hover:bg-muted/40"
                        >
                          <ListFilter className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cari di: {searchOptions.find(o => o.value === searchTargetField)?.label || "Semua Kolom"}
                    </TooltipContent>
                  </Tooltip>
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
                  {isServerSearching ? (
                    <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
                  ) : (
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  )}
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/80 shrink-0 relative">
                          <Filter className="h-3.5 w-3.5" />
                          <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center">
                            {statusFilter.length}
                          </Badge>
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Status ({statusFilter.length})</TooltipContent>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border bg-card shadow-xs">
                    {CONTENT_STATUSES.map(s => (
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

                {/* Author Filter */}
                {authors.length > 0 && (
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button variant={authorFilter ? "default" : "outline"} size="icon" className="h-9 w-9 rounded-xl shrink-0">
                            <User className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        {authorFilter
                          ? `Penulis: ${authors.find(a => a.id === authorFilter)?.name || authors.find(a => a.id === authorFilter)?.email || "Penulis"}`
                          : "Semua Penulis"}
                      </TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent align="end" className="w-56 max-h-[300px] overflow-y-auto rounded-xl border-border bg-card shadow-xs">
                      <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Filter Berdasarkan Penulis</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuRadioGroup value={authorFilter} onValueChange={setAuthorFilter}>
                        <DropdownMenuRadioItem value="" className="text-xs font-medium cursor-pointer rounded-lg">
                          Semua Penulis
                        </DropdownMenuRadioItem>
                        {authors.map((a) => (
                          <DropdownMenuRadioItem key={a.id} value={a.id} className="text-xs font-medium cursor-pointer rounded-lg">
                            {a.name || a.email}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Date Range Filter */}
                <Popover>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button variant={hasDateFilter ? "default" : "outline"} size="icon" className="h-9 w-9 rounded-xl shrink-0">
                          <CalendarRange className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Tanggal{hasDateFilter ? " (aktif)" : ""}</TooltipContent>
                  </Tooltip>
                  <PopoverContent align="end" className="w-72 rounded-xl p-3 space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Berdasarkan</label>
                      <UiSelect value={dateField} onValueChange={(v) => setDateField(v as "createdAt" | "publishedAt")}>
                        <UiSelectTrigger className="h-8 text-xs rounded-lg">
                          <UiSelectValue />
                        </UiSelectTrigger>
                        <UiSelectContent>
                          <UiSelectItem value="createdAt" className="text-xs">Tanggal Dibuat</UiSelectItem>
                          <UiSelectItem value="publishedAt" className="text-xs">Tanggal Dipublikasikan</UiSelectItem>
                        </UiSelectContent>
                      </UiSelect>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Dari</label>
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs rounded-lg" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">Sampai</label>
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs rounded-lg" />
                      </div>
                    </div>
                    {hasDateFilter && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs font-bold w-full rounded-lg"
                        onClick={() => { setDateFrom(""); setDateTo("") }}
                      >
                        <X className="h-3 w-3 mr-1" /> Reset Filter Tanggal
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
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
                    {bulkEditableFields.length > 0 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs font-bold rounded-lg"
                        onClick={() => setIsBulkEditOpen(true)}
                        title="Ubah nilai satu field di semua entri terpilih"
                      >
                        <Edit className="h-3 w-3 mr-1 text-primary" /> Edit Field
                      </Button>
                    )}
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

                {/* Trash toggle */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant={isTrashView ? "default" : "outline"}
                      size="icon"
                      onClick={handleToggleTrashView}
                      className="h-9 w-9 rounded-xl shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Sampah</TooltipContent>
                </Tooltip>

                {/* Export entries as JSON */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleExportEntries}
                      disabled={isExportingEntries}
                      className="h-9 w-9 rounded-xl border-border/80 shadow-xs hover:bg-muted/40"
                    >
                      {isExportingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ekspor Data (JSON)</TooltipContent>
                </Tooltip>

                {/* Export entries as CSV (flattened report view, not for re-import) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleExportEntriesCsv}
                      disabled={isExportingCsv}
                      className="h-9 w-9 rounded-xl border-border/80 shadow-xs hover:bg-muted/40"
                    >
                      {isExportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ekspor Data (CSV)</TooltipContent>
                </Tooltip>

                {/* Import entries from JSON */}
                {canCreateEntry && (
                  <>
                    <input
                      ref={importFileInputRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={handleImportFileSelected}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => importFileInputRef.current?.click()}
                          disabled={isImportingEntries}
                          className="h-9 w-9 rounded-xl border-border/80 shadow-xs hover:bg-muted/40"
                        >
                          {isImportingEntries ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-primary rotate-180" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Impor Data (JSON)</TooltipContent>
                    </Tooltip>
                  </>
                )}

                {/* Column Visibility Manager Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setIsColumnModalOpen(true)}
                      className="h-9 w-9 rounded-xl border-border/80 shadow-xs hover:bg-muted/40 relative"
                    >
                      <Columns className="h-3.5 w-3.5 text-primary" />
                      <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center">
                        {visibleColumns.length}
                      </Badge>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Atur Kolom ({visibleColumns.length})</TooltipContent>
                </Tooltip>

                {/* View Mode Switcher (Table vs Kanban vs Calendar) */}
                <div className="flex items-center p-1 bg-muted/40 rounded-xl border border-border/80 shadow-xs gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all border-none",
                          viewMode === "table" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewModeChange("table")}
                      >
                        <Table2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Tampilan Tabel</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all border-none",
                          viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewModeChange("kanban")}
                      >
                        <Kanban className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Tampilan Kanban</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-7 w-7 rounded-lg transition-all border-none",
                          viewMode === "calendar" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => handleViewModeChange("calendar")}
                      >
                        <CalendarRange className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Tampilan Kalender</TooltipContent>
                  </Tooltip>
                </div>
              </div>

            </div>
          </Card>

          {isTrashView ? (
            <TrashPanel
              entries={trashedEntries}
              isLoading={isLoadingTrash}
              restoringEntryId={restoringEntryId}
              purgingEntryId={purgingEntryId}
              onRestore={handleRestoreEntry}
              onPermanentlyDelete={handlePermanentlyDeleteEntry}
              restoreWindowDays={TRASH_RESTORE_WINDOW_DAYS}
            />
          ) : isServerSearching || searchQuery.trim() !== debouncedSearch ? (
            <p role="status" className="py-6 text-center text-sm text-muted-foreground">Memuat entri…</p>
          ) : searchError ? (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4">
              <p className="text-sm text-destructive">{searchError}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => setSearchAttempt(value => value + 1)}>
                Coba lagi
              </Button>
            </div>
          ) : (
          <>
          {/* Conditional View: Kanban Board vs Table vs Calendar */}
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
          ) : viewMode === "calendar" ? (
            <div className="pt-1 animate-in fade-in duration-200">
              <ContentCalendarView
                entries={filteredEntries}
                tenantSlug={tenantSlug}
                contentTypeSlug={contentTypeSlug}
                navBasePath={navBasePath}
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

                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-center py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("status")}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground"
                      >
                        Status
                        {sortBy === "status" ? (
                          sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("updatedAt")}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-foreground"
                      >
                        Terakhir Diubah
                        {sortBy === "updatedAt" ? (
                          sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    </TableHead>
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
                            onClick={() => { setSearchQuery(""); setSearchTargetField("all"); setStatusFilter([...CONTENT_STATUSES]) }}
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
                                      copyToClipboard(JSON.stringify(entry.data, null, 2))
                                      toast({ title: "JSON Disalin ke Clipboard" })
                                    }}
                                  >
                                    <Download className="h-3.5 w-3.5" /> Salin JSON
                                  </DropdownMenuItem>

                                  {canCreateEntry && (
                                    <DropdownMenuItem
                                      className="text-xs font-medium rounded-lg cursor-pointer gap-2 py-1.5"
                                      disabled={duplicatingEntryId === entry.id}
                                      onClick={() => handleDuplicateEntry(entry.id)}
                                    >
                                      {duplicatingEntryId === entry.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                      )}
                                      Duplikat Entri
                                    </DropdownMenuItem>
                                  )}

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

          {hasMoreEntries && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMoreEntries}
                disabled={isLoadingMore || isServerSearching || searchQuery.trim() !== debouncedSearch}
                className="h-9 text-xs font-bold rounded-xl gap-1.5"
              >
                {isLoadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Muat Lebih Banyak ({entries.length} dimuat)
              </Button>
            </div>
          )}
          </>
          )}

        </div>
      </div>
    </div>
  )
}

function TrashPanel({
  entries,
  isLoading,
  restoringEntryId,
  purgingEntryId,
  onRestore,
  onPermanentlyDelete,
  restoreWindowDays,
}: {
  entries: any[]
  isLoading: boolean
  restoringEntryId: string | null
  purgingEntryId: string | null
  onRestore: (id: string) => void
  onPermanentlyDelete: (id: string) => void
  restoreWindowDays: number
}) {
  return (
    <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card animate-in fade-in duration-200">
      <div className="px-4 py-3 border-b border-border/60 bg-amber-500/5">
        <p className="text-xs font-medium text-muted-foreground">
          Entri di sini otomatis dihapus permanen setelah <span className="font-bold text-foreground">{restoreWindowDays} hari</span>. Pulihkan sebelum itu jika masih dibutuhkan.
        </p>
      </div>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center border border-border/60">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-bold text-xs text-foreground mt-1">Sampah kosong</p>
            <p className="text-[11px] text-muted-foreground">Entri yang dihapus akan muncul di sini.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/20 border-b border-border/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3 pl-5">Entri</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Dihapus Pada</TableHead>
                <TableHead className="text-right pr-5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/20 transition-colors border-b border-border/60 last:border-b-0">
                  <TableCell className="pl-5 py-3 text-xs font-semibold text-foreground">
                    {extractEntryLabel(entry.data, entry.id)}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground" suppressHydrationWarning>
                    {entry.deletedAt ? new Date(entry.deletedAt).toLocaleString('id-ID') : "-"}
                  </TableCell>
                  <TableCell className="text-right pr-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1.5"
                        disabled={restoringEntryId === entry.id}
                        onClick={() => onRestore(entry.id)}
                      >
                        {restoringEntryId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Pulihkan
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 rounded-xl text-red-600 hover:bg-red-500/10 hover:text-red-700 text-xs font-bold gap-1.5"
                        disabled={purgingEntryId === entry.id}
                        onClick={() => onPermanentlyDelete(entry.id)}
                      >
                        {purgingEntryId === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Hapus Permanen
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
  )
}
