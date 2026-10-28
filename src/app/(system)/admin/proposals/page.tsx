"use client"

import { useEffect, useState } from "react"
import { Handshake, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { ProposalKanbanBoard } from "@/components/admin/proposals/proposal-kanban-board"
import { ProposalCreateDialog } from "@/components/admin/proposals/proposal-create-dialog"
import { ProposalDetailDialog } from "@/components/admin/proposals/proposal-detail-dialog"
import type { Proposal } from "@/components/admin/proposals/types"
import type { ProposalStage } from "@/lib/proposal-stages"

export default function ProposalsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null)

  const fetchProposals = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/proposals")
      if (res.ok) {
        const body = await res.json()
        setProposals(body.proposals)
      }
    } catch {
      toast({ variant: "destructive", title: "Gagal Memuat Penawaran" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProposals()
  }, [])

  const handleStageChange = async (id: string, stage: ProposalStage, lostReason?: string): Promise<boolean> => {
    const previous = proposals
    setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)))
    try {
      const res = await fetch(`/api/admin/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, ...(lostReason ? { lostReason } : {}) }),
      })
      if (!res.ok) {
        setProposals(previous)
        const body = await res.json().catch(() => ({}))
        toast({ variant: "destructive", title: "Gagal Mengubah Stage", description: body.error })
        return false
      }
      const body = await res.json()
      setProposals((prev) => prev.map((p) => (p.id === id ? body.proposal : p)))
      return true
    } catch {
      setProposals(previous)
      toast({ variant: "destructive", title: "Terjadi Kesalahan" })
      return false
    }
  }

  const handleCreated = (proposal: Proposal) => {
    setProposals((prev) => [proposal, ...prev])
  }

  const handleUpdated = (proposal: Proposal) => {
    setProposals((prev) => prev.map((p) => (p.id === proposal.id ? { ...p, ...proposal } : p)))
    setDetailProposal((prev) => (prev && prev.id === proposal.id ? { ...prev, ...proposal } : prev))
  }

  const handleDeleted = (id: string) => {
    setProposals((prev) => prev.filter((p) => p.id !== id))
    setDetailProposal(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <Handshake className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-foreground">Penawaran</h1>
              <Badge variant="outline" className="text-[10px] font-bold">{proposals.length} Total</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pipeline penawaran kerja sama ke instansi — UMKM, sekolah, pemerintah, dan lainnya.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="rounded-xl font-bold">
          <Plus className="h-4 w-4 mr-1.5" /> Penawaran Baru
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <ProposalKanbanBoard
          proposals={proposals}
          onOpenDetail={setDetailProposal}
          onStageChange={handleStageChange}
        />
      )}

      <ProposalCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={handleCreated} />
      <ProposalDetailDialog
        proposal={detailProposal}
        onOpenChange={(open) => !open && setDetailProposal(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </div>
  )
}
