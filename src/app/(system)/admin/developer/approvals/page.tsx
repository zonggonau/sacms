"use client"

import { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Check, X, Loader2, ShieldCheck, RefreshCw, Inbox } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useConfirm } from "@/components/ui/confirm-dialog"

interface ApprovalRequest {
  id: string
  action: string
  actionLabel: string
  targetId: string
  targetName: string
  details: { dependents?: Array<{ id: string; name: string; slug: string }> } | null
  status: "pending" | "processing" | "approved" | "rejected" | "failed"
  requestedByName: string | null
  resultMessage: string | null
  createdAt: string
  decidedAt: string | null
}

const STATUS_BADGE: Record<ApprovalRequest["status"], { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  processing: { label: "Diproses", className: "bg-primary/10 text-primary border-primary/30" },
  approved: { label: "Disetujui", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
  rejected: { label: "Ditolak", className: "bg-muted/60 text-muted-foreground border-border" },
  failed: { label: "Gagal", className: "bg-destructive/10 text-destructive border-destructive/30" },
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function AdminMcpApprovalsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { confirm, dialog: confirmDialog } = useConfirm()

  const [filter, setFilter] = useState<"pending" | "all">("pending")
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deciding, setDeciding] = useState<string | null>(null)

  const isAdmin = session?.user?.role === "super_admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/mcp-approvals${filter === "pending" ? "?status=pending" : ""}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message || body?.error || "Gagal memuat permintaan")
      setRequests(body.requests)
      setPendingCount(body.pendingCount)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal memuat", description: err.message })
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  const decide = async (request: ApprovalRequest, decision: "approve" | "reject") => {
    if (decision === "approve" && request.action === "cascade_delete_schema_template") {
      const count = request.details?.dependents?.length ?? 0
      const ok = await confirm({
        title: `Hapus "${request.targetName}" beserta ${count} Website Template?`,
        description: "Schema Template, seluruh Website Template yang memakainya, riwayat versinya, project demo di hosting, dan workspace demo akan dihapus permanen. Workspace yang sudah memakai template ini tidak terpengaruh.",
        confirmLabel: "Setujui & Hapus",
        variant: "destructive",
      })
      if (!ok) return
    }
    setDeciding(request.id)
    try {
      const res = await fetch(`/api/admin/mcp-approvals/${request.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error?.message || body?.error || "Gagal menyimpan keputusan")
      if (body.status === "failed") {
        toast({ variant: "destructive", title: "Disetujui, tapi gagal diterapkan", description: body.message })
      } else {
        toast({ title: decision === "approve" ? "Disetujui" : "Ditolak", description: body.message })
      }
      await load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message })
      await load()
    } finally {
      setDeciding(null)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      {confirmDialog}
      <div className="p-4 md:p-6 lg:p-8 w-full max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Persetujuan MCP</h1>
              {pendingCount > 0 && (
                <Badge variant="outline" className={`text-[10px] font-bold rounded-full ${STATUS_BADGE.pending.className}`}>
                  {pendingCount} menunggu
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
              AI agent di MCP Server Developer hanya bisa <strong className="text-foreground">mengajukan</strong> publikasi, schema default untuk workspace baru, dan hapus berantai. Perubahan itu baru berlaku setelah disetujui di sini.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 rounded-xl text-xs font-bold shrink-0">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Muat Ulang
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as "pending" | "all")}>
          <TabsList>
            <TabsTrigger value="pending" className="text-xs">Menunggu</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">Semua (100 terakhir)</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading && requests.length === 0 ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : requests.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 shadow-none">
            <CardContent className="py-12 flex flex-col items-center text-center gap-2">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">{filter === "pending" ? "Tidak ada permintaan yang menunggu" : "Belum ada permintaan"}</p>
              <p className="text-xs text-muted-foreground max-w-sm">Saat agent meminta publikasi atau penghapusan berantai, permintaannya muncul di sini.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-card">
            {requests.map((request) => {
              const badge = STATUS_BADGE[request.status] ?? STATUS_BADGE.pending
              const dependents = request.details?.dependents ?? []
              return (
                <div key={request.id} className="flex flex-col md:flex-row md:items-start gap-3 p-4">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] font-bold rounded-full ${badge.className}`}>{badge.label}</Badge>
                      <span className="text-xs font-bold text-foreground">{request.actionLabel}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground break-words">{request.targetName}</p>
                    {dependents.length > 0 && (
                      <p className="text-[11px] text-destructive">
                        Ikut terhapus: {dependents.map((d) => d.name).join(", ")}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Diajukan oleh token <span className="font-semibold text-foreground">{request.requestedByName || "—"}</span> · {formatDateTime(request.createdAt)}
                      {request.decidedAt && <> · diputuskan {formatDateTime(request.decidedAt)}</>}
                    </p>
                    {request.resultMessage && (
                      <p className={`text-[11px] ${request.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>{request.resultMessage}</p>
                    )}
                  </div>
                  {request.status === "pending" && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={deciding !== null}
                        onClick={() => decide(request, "approve")}
                        variant={request.action === "cascade_delete_schema_template" ? "destructive" : "default"}
                        className="h-8 px-3 rounded-xl text-xs font-bold"
                      >
                        {deciding === request.id ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                        Setujui
                      </Button>
                      <Button size="sm" variant="outline" disabled={deciding !== null} onClick={() => decide(request, "reject")} className="h-8 px-3 rounded-xl text-xs font-bold">
                        <X className="h-3.5 w-3.5 mr-1.5" /> Tolak
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-start gap-2 p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <span>Agent bisa mengecek hasil keputusan lewat tool <code className="font-mono text-foreground">get_approval_status</code>. Mengajukan hal yang sama dua kali tidak membuat permintaan ganda.</span>
        </div>
      </div>
    </div>
  )
}
