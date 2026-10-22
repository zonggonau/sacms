"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Server, RefreshCw, Loader2, Eye, EyeOff, Copy, Check, AlertCircle, Database } from "lucide-react"

interface VpsInstanceSummary {
  id: string
  status: string
  billingCycle: string
  hostname: string | null
  ipAddress: string | null
  rootUser: string | null
  rootPassword: string | null // masked ("••••••••") unless just revealed
  failureReason: string | null
  dbStorageStatus: string
  dbStorageError: string | null
  nextDueAt: string | null
  createdAt: string
  offering: { name: string; osLabel: string; cpuCores: number; memoryMb: number; diskGb: number } | null
}

const STATUS_LABEL: Record<string, string> = {
  provisioning: "Sedang Disiapkan",
  active: "Aktif",
  failed: "Gagal",
  terminated: "Dihentikan",
}

const DB_STORAGE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu VPS Aktif",
  connecting: "Memasang PostgreSQL & MinIO…",
  connected: "Terhubung ke Database & Storage",
  skipped: "Dilewati",
  failed: "Gagal Disiapkan",
}

/**
 * Purchased-VPS status list — account-scoped (/dashboard/billing) or
 * workspace-scoped (/dashboard/[tenant]/subscriptions?tab=storage), same
 * component either way via `scope`. No background polling: a manual
 * "Refresh Status" button calls Biznet Gio live on demand (see
 * src/app/api/{user,tenant/[tenant]}/vps-instances/[id]/refresh) — the real
 * provisioning timing was never observed with a live create call while
 * this feature was built, so a cron can't yet be tuned sensibly.
 */
export function VpsStatusList({ scope, tenantSlug }: { scope: "account" | "tenant"; tenantSlug?: string }) {
  const { toast } = useToast()
  const [instances, setInstances] = useState<VpsInstanceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshingId, setRefreshingId] = useState<string | null>(null)
  const [revealedId, setRevealedId] = useState<string | null>(null)
  const [revealedCreds, setRevealedCreds] = useState<{ rootUser: string; rootPassword: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const listUrl = scope === "account" ? "/api/user/vps-instances" : `/api/tenant/${tenantSlug}/vps-instances`
  const refreshUrl = (id: string) => scope === "account" ? `/api/user/vps-instances/${id}/refresh` : `/api/tenant/${tenantSlug}/vps-instances/${id}/refresh`
  const revealUrl = (id: string) => `${listUrl}?reveal=${id}`

  const load = async () => {
    try {
      const res = await fetch(listUrl)
      if (res.ok) {
        const data = await res.json()
        setInstances(data.instances || [])
      }
    } catch {
      // Section just stays empty — the purchase grid below still works.
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (scope === "tenant" && !tenantSlug) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, tenantSlug])

  if (loading || instances.length === 0) return null

  const handleRefresh = async (id: string) => {
    setRefreshingId(id)
    try {
      const res = await fetch(refreshUrl(id), { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Status Diperbarui", description: data.ipAddress ? `IP: ${data.ipAddress}` : "VPS masih dalam proses penyiapan." })
        await load()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: data.error || "Gagal memperbarui status." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memperbarui status VPS." })
    } finally {
      setRefreshingId(null)
    }
  }

  const handleReveal = async (id: string) => {
    if (revealedId === id) {
      setRevealedId(null)
      setRevealedCreds(null)
      return
    }
    try {
      const res = await fetch(revealUrl(id))
      const data = await res.json()
      if (res.ok) {
        setRevealedId(id)
        setRevealedCreds({ rootUser: data.rootUser, rootPassword: data.rootPassword })
      } else {
        toast({ variant: "destructive", title: "Gagal", description: data.error || "Gagal menampilkan kredensial." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menampilkan kredensial." })
    }
  }

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(key)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="space-y-2.5">
      {instances.map((instance) => {
        const isRefreshing = refreshingId === instance.id
        const isRevealed = revealedId === instance.id
        const statusColor =
          instance.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : instance.status === "failed" ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
          : instance.status === "terminated" ? "bg-muted text-muted-foreground border-border"
          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"

        return (
          <Card key={instance.id} className="border border-border/80 bg-card/60 shadow-xs rounded-2xl overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Server className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{instance.offering?.name || "VPS"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {instance.offering ? `${instance.offering.cpuCores} vCPU · ${(instance.offering.memoryMb / 1024).toFixed(1)} GB RAM · ${instance.offering.osLabel}` : "-"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", statusColor)}>
                  {instance.status === "provisioning" && <Loader2 className="h-2.5 w-2.5 mr-1 inline animate-spin" />}
                  {STATUS_LABEL[instance.status] || instance.status}
                </Badge>
              </div>

              {instance.status === "failed" && instance.failureReason && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400 bg-red-500/5 border border-red-500/15 rounded-xl px-3 py-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{instance.failureReason} — tim SaCMS sudah diberi tahu untuk menindaklanjuti.</span>
                </div>
              )}

              {/* Database & Storage auto-setup — this VPS's whole purpose
                  (PostgreSQL + MinIO auto-installed via SSH, then wired
                  into this account's/workspace's BYODB/BYOS settings once
                  the VM has a real IP — see src/lib/vps-db-storage.ts). */}
              {instance.status !== "failed" && (
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-1.5 text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> Database & Storage
                  </span>
                  <span className={cn(
                    "font-bold flex items-center gap-1",
                    instance.dbStorageStatus === "connected" ? "text-emerald-600 dark:text-emerald-400"
                      : instance.dbStorageStatus === "failed" ? "text-red-600 dark:text-red-400"
                      : instance.dbStorageStatus === "skipped" ? "text-amber-600 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}>
                    {instance.dbStorageStatus === "connecting" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {DB_STORAGE_STATUS_LABEL[instance.dbStorageStatus] || instance.dbStorageStatus}
                  </span>
                </div>
              )}
              {(instance.dbStorageStatus === "failed" || instance.dbStorageStatus === "skipped") && instance.dbStorageError && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{instance.dbStorageError}</p>
              )}

              {instance.ipAddress && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-1.5">
                    <span className="text-muted-foreground">IP Address</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground">{instance.ipAddress}</span>
                      <button type="button" onClick={() => handleCopy(instance.ipAddress!, `ip-${instance.id}`)} className="text-muted-foreground hover:text-foreground">
                        {copied === `ip-${instance.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-1.5">
                    <span className="text-muted-foreground">Root User</span>
                    <span className="font-mono font-bold text-foreground">{instance.rootUser || "root"}</span>
                  </div>
                </div>
              )}

              {instance.rootPassword && (
                <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-1.5 text-[11px]">
                  <span className="text-muted-foreground">Root Password</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-foreground">
                      {isRevealed && revealedCreds ? revealedCreds.rootPassword : instance.rootPassword}
                    </span>
                    {isRevealed && revealedCreds && (
                      <button type="button" onClick={() => handleCopy(revealedCreds.rootPassword, `pw-${instance.id}`)} className="text-muted-foreground hover:text-foreground">
                        {copied === `pw-${instance.id}` ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                    <button type="button" onClick={() => handleReveal(instance.id)} className="text-muted-foreground hover:text-foreground">
                      {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              )}

              {instance.status !== "terminated" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-border/80"
                  disabled={isRefreshing}
                  onClick={() => handleRefresh(instance.id)}
                >
                  {isRefreshing ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Refresh Status
                </Button>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
