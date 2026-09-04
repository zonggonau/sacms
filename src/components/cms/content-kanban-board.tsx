"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  FileText,
  Clock,
  CheckCircle2,
  Archive,
  AlertCircle,
  MoreHorizontal,
  Edit,
  Eye,
  Trash2,
  Plus,
  Calendar,
  User,
  ExternalLink,
  Sparkles,
  GripVertical,
  Check,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { updateContentEntryStatusAction, deleteEntryAction } from "@/actions/content"
import { allowedUserTransitions, isWorkflowStatus, WorkflowStatus } from "@/lib/content-workflow-rules"

export const KANBAN_COLUMNS: {
  id: WorkflowStatus
  label: string
  color: string
  badgeColor: string
  headerBg: string
  borderColor: string
  icon: React.ElementType
}[] = [
  {
    id: "DRAFT",
    label: "Draft",
    color: "text-zinc-600 dark:text-zinc-400",
    badgeColor: "bg-muted text-muted-foreground border-border/80",
    headerBg: "bg-muted/40",
    borderColor: "border-border/60",
    icon: FileText,
  },
  {
    id: "IN_REVIEW",
    label: "In Review",
    color: "text-amber-600 dark:text-amber-400",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    headerBg: "bg-amber-500/5",
    borderColor: "border-amber-500/20",
    icon: Clock,
  },
  {
    id: "APPROVED",
    label: "Approved",
    color: "text-blue-600 dark:text-blue-400",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    headerBg: "bg-blue-500/5",
    borderColor: "border-blue-500/20",
    icon: CheckCircle2,
  },
  {
    id: "SCHEDULED",
    label: "Scheduled",
    color: "text-purple-600 dark:text-purple-400",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    headerBg: "bg-purple-500/5",
    borderColor: "border-purple-500/20",
    icon: Calendar,
  },
  {
    id: "PUBLISHED",
    label: "Published",
    color: "text-emerald-600 dark:text-emerald-400",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    headerBg: "bg-emerald-500/5",
    borderColor: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  {
    id: "ARCHIVED",
    label: "Archived",
    color: "text-zinc-500",
    badgeColor: "bg-zinc-500/10 text-zinc-500 border-zinc-500/30",
    headerBg: "bg-zinc-500/5",
    borderColor: "border-zinc-500/20",
    icon: Archive,
  },
]

import { extractEntryLabel } from "@/lib/relation-labels"

function extractCardTitle(entry: any): string {
  const data = entry.data || {}
  return extractEntryLabel(data, entry.id)
}

function extractCardImage(entry: any): string | null {
  const data = entry.data || {}
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string" && (val.startsWith("http") || val.startsWith("/api/tenant")) && /\.(jpg|jpeg|png|webp|gif|svg)/i.test(val)) {
      return val
    }
    if (typeof val === "object" && val !== null && (val as any).url) {
      return (val as any).url
    }
    if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string" && /\.(jpg|jpeg|png|webp|gif|svg)/i.test(val[0])) {
      return val[0]
    }
  }
  return null
}

interface ContentKanbanBoardProps {
  entries: any[]
  tenantSlug: string
  contentTypeSlug: string
  userRole?: string
  customPermissions?: string[] | null
  navBasePath: string
  onStatusChange?: (entryId: string, newStatus: string) => void
  onDeleteEntry?: (entryId: string) => void
}

export function ContentKanbanBoard({
  entries: initialEntries,
  tenantSlug,
  contentTypeSlug,
  userRole = "owner",
  customPermissions = null,
  navBasePath,
  onStatusChange,
  onDeleteEntry,
}: ContentKanbanBoardProps) {
  const router = useRouter()
  const { confirm, dialog: confirmDialog } = useConfirm()
  const [entries, setEntries] = useState<any[]>(initialEntries)
  const [activeCard, setActiveCard] = useState<any | null>(null)

  // Update entries when parent prop changes
  React.useEffect(() => {
    setEntries(initialEntries)
  }, [initialEntries])

  // Group entries by status column
  const columnEntries = useMemo(() => {
    const map: Record<string, any[]> = {
      DRAFT: [],
      IN_REVIEW: [],
      APPROVED: [],
      SCHEDULED: [],
      PUBLISHED: [],
      ARCHIVED: [],
      REJECTED: [],
    }
    for (const entry of entries) {
      const st = entry.status && map[entry.status] ? entry.status : "DRAFT"
      map[st].push(entry)
    }
    return map
  }, [entries])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts to prevent accidental clicks
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const found = entries.find((e) => e.id === active.id)
    if (found) {
      setActiveCard(found)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)

    if (!over) return

    const activeEntryId = String(active.id)
    const targetColumnId = String(over.id)

    // Determine target status
    let targetStatus: string = targetColumnId
    // If dropped over a card, find that card's column
    if (!KANBAN_COLUMNS.some((c) => c.id === targetColumnId)) {
      const overEntry = entries.find((e) => e.id === targetColumnId)
      if (overEntry) {
        targetStatus = overEntry.status
      } else {
        return
      }
    }

    const currentEntry = entries.find((e) => e.id === activeEntryId)
    if (!currentEntry || currentEntry.status === targetStatus) return

    // Verify role transition permission
    if (isWorkflowStatus(currentEntry.status) && isWorkflowStatus(targetStatus)) {
      const allowed = allowedUserTransitions(currentEntry.status, userRole, customPermissions)
      if (!allowed.includes(targetStatus)) {
        toast({
          title: "Transisi Tidak Diizinkan",
          description: `Peran '${userRole}' tidak diizinkan memindahkan status dari '${currentEntry.status}' langsung ke '${targetStatus}'.`,
          variant: "destructive",
        })
        return
      }
    }

    // Optimistic Update
    const previousStatus = currentEntry.status
    const updatedEntries = entries.map((e) => (e.id === activeEntryId ? { ...e, status: targetStatus } : e))
    setEntries(updatedEntries)

    try {
      const res = await updateContentEntryStatusAction(
        tenantSlug,
        contentTypeSlug,
        activeEntryId,
        targetStatus
      )

      if (!res || (res as any).error) {
        // Rollback
        setEntries((prev) => prev.map((e) => (e.id === activeEntryId ? { ...e, status: previousStatus } : e)))
        toast({
          title: "Gagal Mengubah Status",
          description: (res as any)?.error || "Gagal memperbarui status",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Status Diperbarui",
          description: `Entri berhasil dipindahkan ke '${targetStatus}'.`,
        })
        if (onStatusChange) onStatusChange(activeEntryId, targetStatus)
      }
    } catch (err: any) {
      // Rollback
      setEntries((prev) => prev.map((e) => (e.id === activeEntryId ? { ...e, status: previousStatus } : e)))
      toast({
        title: "Terjadi Kesalahan",
        description: err.message || "Gagal menghubungi server",
        variant: "destructive",
      })
    }
  }

  const handleDeleteCard = async (entryId: string) => {
    if (
      !(await confirm({
        title: "Hapus entri ini?",
        confirmLabel: "Hapus entri",
        variant: "destructive",
      }))
    )
      return

    try {
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, entryId)
      if (res.error) {
        toast({
          title: "Gagal Menghapus",
          description: res.error,
          variant: "destructive",
        })
      } else {
        setEntries((prev) => prev.filter((e) => e.id !== entryId))
        toast({
          title: "Entri Dihapus",
          description: "Entri berhasil dihapus.",
        })
        if (onDeleteEntry) onDeleteEntry(entryId)
      }
    } catch (err: any) {
      toast({
        title: "Terjadi Kesalahan",
        description: err.message || "Terjadi kesalahan saat menghapus entri.",
        variant: "destructive",
      })
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {confirmDialog}
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-1 min-h-[calc(100vh-280px)] scrollbar-thin">
        {KANBAN_COLUMNS.map((col) => {
          const colItems = columnEntries[col.id] || []
          return (
            <KanbanColumnDroppable
              key={col.id}
              column={col}
              entries={colItems}
              tenantSlug={tenantSlug}
              contentTypeSlug={contentTypeSlug}
              navBasePath={navBasePath}
              onDeleteCard={handleDeleteCard}
              userRole={userRole}
              customPermissions={customPermissions}
              onDirectStatusChange={async (entryId, newStatus) => {
                const res = await updateContentEntryStatusAction(tenantSlug, contentTypeSlug, entryId, newStatus)
                if (!res || (res as any).error) {
                  toast({ title: "Gagal", description: (res as any)?.error || "Gagal mengubah status", variant: "destructive" })
                } else {
                  setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, status: newStatus } : e)))
                  toast({ title: "Status Berubah", description: `Dipindahkan ke ${newStatus}` })
                }
              }}
            />
          )
        })}
      </div>

      {/* Drag Overlay (Card ghost while dragging) */}
      <DragOverlay>
        {activeCard ? (
          <div className="w-[280px] rotate-2 shadow-2xl opacity-90 cursor-grabbing">
            <KanbanCardItem
              entry={activeCard}
              tenantSlug={tenantSlug}
              contentTypeSlug={contentTypeSlug}
              navBasePath={navBasePath}
              isOverlay
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumnDroppable({
  column,
  entries,
  tenantSlug,
  contentTypeSlug,
  navBasePath,
  onDeleteCard,
  userRole,
  customPermissions,
  onDirectStatusChange,
}: {
  column: (typeof KANBAN_COLUMNS)[0]
  entries: any[]
  tenantSlug: string
  contentTypeSlug: string
  navBasePath: string
  onDeleteCard: (id: string) => void
  userRole: string
  customPermissions: string[] | null
  onDirectStatusChange: (id: string, st: string) => void
}) {
  const router = useRouter()
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  })

  const Icon = column.icon

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[300px] shrink-0 rounded-2xl border bg-muted/20 backdrop-blur-xs transition-all duration-200 shadow-xs",
        column.borderColor,
        isOver && "bg-primary/5 ring-2 ring-primary/30 border-primary/40 scale-[1.01]"
      )}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3.5 py-3 rounded-t-2xl border-b",
          column.headerBg,
          column.borderColor
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", column.color)} />
          <span className="text-xs font-black uppercase tracking-wider text-foreground">{column.label}</span>
          <Badge
            variant="outline"
            className={cn("h-5 px-1.5 text-[10px] font-black rounded-full border-none", column.badgeColor)}
          >
            {entries.length}
          </Badge>
        </div>

        {column.id === "DRAFT" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/new`)}
            title="Tambah Entri Draft Baru"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Column Body / Cards List */}
      <div className="flex-1 p-2.5 space-y-2.5 min-h-[160px] overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-thin">
        {entries.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/60 rounded-xl bg-background/30 text-muted-foreground">
            <p className="text-xs font-medium">Tidak ada entri</p>
            <p className="text-[10px] opacity-70 mt-0.5">Tarik kartu ke sini untuk memindahkan</p>
          </div>
        ) : (
          entries.map((entry) => (
            <KanbanCardDraggable
              key={entry.id}
              entry={entry}
              tenantSlug={tenantSlug}
              contentTypeSlug={contentTypeSlug}
              navBasePath={navBasePath}
              onDeleteCard={onDeleteCard}
              userRole={userRole}
              customPermissions={customPermissions}
              onDirectStatusChange={onDirectStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

function KanbanCardDraggable({
  entry,
  tenantSlug,
  contentTypeSlug,
  navBasePath,
  onDeleteCard,
  userRole,
  customPermissions,
  onDirectStatusChange,
}: {
  entry: any
  tenantSlug: string
  contentTypeSlug: string
  navBasePath: string
  onDeleteCard: (id: string) => void
  userRole: string
  customPermissions: string[] | null
  onDirectStatusChange: (id: string, st: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: entry.id,
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(isDragging && "opacity-30 scale-95 transition-all")}
    >
      <KanbanCardItem
        entry={entry}
        tenantSlug={tenantSlug}
        contentTypeSlug={contentTypeSlug}
        navBasePath={navBasePath}
        onDeleteCard={onDeleteCard}
        userRole={userRole}
        customPermissions={customPermissions}
        onDirectStatusChange={onDirectStatusChange}
      />
    </div>
  )
}

function KanbanCardItem({
  entry,
  tenantSlug,
  contentTypeSlug,
  navBasePath,
  onDeleteCard,
  userRole = "owner",
  customPermissions = null,
  onDirectStatusChange,
  isOverlay = false,
}: {
  entry: any
  tenantSlug: string
  contentTypeSlug: string
  navBasePath: string
  onDeleteCard?: (id: string) => void
  userRole?: string
  customPermissions?: string[] | null
  onDirectStatusChange?: (id: string, st: string) => void
  isOverlay?: boolean
}) {
  const router = useRouter()
  const title = extractCardTitle(entry)
  const imageUrl = extractCardImage(entry)
  const locale = entry.locale || "id"
  const formattedDate = new Date(entry.updatedAt || entry.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })

  const availableTransitions = isWorkflowStatus(entry.status)
    ? allowedUserTransitions(entry.status, userRole, customPermissions)
    : []

  const handleCardClick = (e: React.MouseEvent) => {
    // Avoid routing if user clicked on action button or menu
    if ((e.target as HTMLElement).closest("button") || (e.target as HTMLElement).closest("[role='menuitem']")) {
      return
    }
    router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${entry.id}`)
  }

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "group relative border border-border/80 bg-card hover:border-primary/50 hover:shadow-md transition-all rounded-xl overflow-hidden cursor-grab active:cursor-grabbing",
        isOverlay && "border-primary shadow-xl ring-2 ring-primary/30"
      )}
    >
      {/* Optional Thumbnail Image */}
      {imageUrl && (
        <div className="h-28 w-full bg-muted/40 overflow-hidden relative border-b border-border/60">
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = "none"
            }}
          />
        </div>
      )}

      <CardContent className="p-3 space-y-2.5">
        {/* Title & Grip */}
        <div className="flex items-start justify-between gap-1.5">
          <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2 flex-1 group-hover:text-primary transition-colors">
            {title}
          </h4>

          {!isOverlay && (
            <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-muted text-muted-foreground">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 text-xs font-medium rounded-xl">
                  <DropdownMenuItem onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${entry.id}`)}>
                    <Edit className="h-3.5 w-3.5 mr-2 text-primary" /> Edit Konten
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => window.open(`/preview/${tenantSlug}/${contentTypeSlug}/${entry.id}`, "_blank")}>
                    <Eye className="h-3.5 w-3.5 mr-2 text-blue-500" /> Preview Live
                  </DropdownMenuItem>

                  {availableTransitions.length > 0 && onDirectStatusChange && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2 py-1">
                        Ubah Status Cepat
                      </DropdownMenuLabel>
                      {availableTransitions.map((targetSt) => (
                        <DropdownMenuItem key={targetSt} onClick={() => onDirectStatusChange(entry.id, targetSt)}>
                          <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground" /> {targetSt}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}

                  {onDeleteCard && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={() => onDeleteCard(entry.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Hapus Entri
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Footer Meta: Locale, Date, Author */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] uppercase font-bold px-1.5 py-0 h-4 bg-muted/60">
              {locale}
            </Badge>
            <span className="truncate max-w-[80px] font-mono text-[9px]">
              #{entry.id.slice(-5)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 opacity-60" />
            <span>{formattedDate}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
