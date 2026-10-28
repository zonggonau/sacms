"use client"

import { useState } from "react"
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  type DragStartEvent,
  type DragEndEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Building2, User, Calendar } from "lucide-react"
import { cn, formatRupiah } from "@/lib/utils"
import { PROPOSAL_STAGES, type ProposalStage } from "@/lib/proposal-stages"
import type { Proposal } from "./types"

interface ProposalKanbanBoardProps {
  proposals: Proposal[]
  onOpenDetail: (proposal: Proposal) => void
  onStageChange: (id: string, stage: ProposalStage, lostReason?: string) => Promise<boolean>
}

const COLUMN_STYLES: Record<string, { header: string; badge: string; border: string }> = {
  slate: { header: "bg-muted/60", badge: "bg-muted text-muted-foreground", border: "border-border/70" },
  blue: { header: "bg-blue-500/10", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400", border: "border-blue-500/20" },
  amber: { header: "bg-amber-500/10", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400", border: "border-amber-500/20" },
  emerald: { header: "bg-emerald-500/10", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20" },
  red: { header: "bg-red-500/10", badge: "bg-red-500/15 text-red-600 dark:text-red-400", border: "border-red-500/20" },
}

export function ProposalKanbanBoard({ proposals, onOpenDetail, onStageChange }: ProposalKanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<Proposal | null>(null)
  const [lostPrompt, setLostPrompt] = useState<{ id: string } | null>(null)
  const [lostReason, setLostReason] = useState("")
  const [savingLost, setSavingLost] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  const columns = PROPOSAL_STAGES.map((stage) => ({
    ...stage,
    items: proposals.filter((p) => p.stage === stage.key),
  }))

  const handleDragStart = (event: DragStartEvent) => {
    const found = proposals.find((p) => p.id === event.active.id)
    if (found) setActiveCard(found)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveCard(null)
    if (!over) return

    const proposalId = String(active.id)
    const targetStage = String(over.id) as ProposalStage
    const current = proposals.find((p) => p.id === proposalId)
    if (!current || current.stage === targetStage) return
    if (!PROPOSAL_STAGES.some((s) => s.key === targetStage)) return

    if (targetStage === "lost") {
      setLostPrompt({ id: proposalId })
      setLostReason("")
      return
    }

    await onStageChange(proposalId, targetStage)
  }

  const confirmLost = async () => {
    if (!lostPrompt) return
    setSavingLost(true)
    const ok = await onStageChange(lostPrompt.id, "lost", lostReason.trim() || undefined)
    setSavingLost(false)
    if (ok) setLostPrompt(null)
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-1 min-h-[60vh] scrollbar-thin">
        {columns.map((col) => (
          <ProposalColumn key={col.key} column={col} onOpenDetail={onOpenDetail} />
        ))}
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="w-[280px] rotate-2 shadow-2xl opacity-90 cursor-grabbing">
            <ProposalCard proposal={activeCard} />
          </div>
        ) : null}
      </DragOverlay>

      <Dialog open={!!lostPrompt} onOpenChange={(open) => !open && !savingLost && setLostPrompt(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Tandai Gagal</DialogTitle>
            <DialogDescription className="text-xs">
              Opsional — catat alasan penawaran ini gagal, untuk referensi tim.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="Contoh: Budget institusi tidak sesuai, memilih vendor lain, dll."
            className="text-xs min-h-24"
            disabled={savingLost}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setLostPrompt(null)} disabled={savingLost}>
              Batal
            </Button>
            <Button size="sm" variant="destructive" onClick={confirmLost} disabled={savingLost}>
              Tandai Gagal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}

function ProposalColumn({
  column,
  onOpenDetail,
}: {
  column: (typeof PROPOSAL_STAGES)[number] & { items: Proposal[] }
  onOpenDetail: (proposal: Proposal) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key })
  const style = COLUMN_STYLES[column.color] ?? COLUMN_STYLES.slate

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-[280px] shrink-0 rounded-2xl border bg-muted/20 backdrop-blur-xs transition-all duration-200 shadow-xs",
        style.border,
        isOver && "bg-primary/5 ring-2 ring-primary/30 border-primary/40 scale-[1.01]"
      )}
    >
      <div className={cn("flex items-center justify-between px-3.5 py-3 rounded-t-2xl border-b", style.header, style.border)}>
        <span className="text-xs font-black uppercase tracking-wider text-foreground">{column.label}</span>
        <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-black rounded-full border-none", style.badge)}>
          {column.items.length}
        </Badge>
      </div>

      <div className="flex-1 p-2.5 space-y-2.5 min-h-[160px] overflow-y-auto max-h-[calc(100vh-340px)] scrollbar-thin">
        {column.items.length === 0 ? (
          <div className="h-28 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border/60 rounded-xl bg-background/30 text-muted-foreground">
            <p className="text-[11px] font-medium">Tidak ada penawaran</p>
          </div>
        ) : (
          column.items.map((proposal) => (
            <ProposalCardDraggable key={proposal.id} proposal={proposal} onOpenDetail={onOpenDetail} />
          ))
        )}
      </div>
    </div>
  )
}

function ProposalCardDraggable({
  proposal,
  onOpenDetail,
}: {
  proposal: Proposal
  onOpenDetail: (proposal: Proposal) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: proposal.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onOpenDetail(proposal)}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <ProposalCard proposal={proposal} />
    </div>
  )
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 shadow-xs hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground line-clamp-2">{proposal.institutionName}</p>
          {proposal.institutionType && (
            <p className="text-[10px] text-muted-foreground truncate">{proposal.institutionType}</p>
          )}
        </div>
      </div>

      {proposal.estimatedValueIdr != null && (
        <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          {formatRupiah(proposal.estimatedValueIdr)}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {proposal.assignedTo ? (
          <span className="flex items-center gap-1 truncate">
            <User className="h-3 w-3 shrink-0" /> {proposal.assignedTo.name || proposal.assignedTo.email}
          </span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-1 shrink-0">
          <Calendar className="h-3 w-3" /> {new Date(proposal.updatedAt).toLocaleDateString("id-ID")}
        </span>
      </div>
    </div>
  )
}
