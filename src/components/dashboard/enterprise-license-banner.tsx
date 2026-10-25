"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Loader2,
  Check,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Pencil,
  RotateCcw,
} from "lucide-react"

interface EnterpriseLicenseInfo {
  valid: boolean
  customerName?: string
  customerEmail?: string
  organization?: string
  type?: string
  features?: string[]
  storageGb?: number | null
  storageUsedBytes?: number | null
  storageLimitBytes?: number | null
  aiCredits?: number | null
  aiCreditsUsed?: number | null
  expiresAt?: string
  issuedAt?: string
  daysRemaining?: number
  totalDays?: number
  status?: string
  error?: string
  /** FR-ENT-005: true for 7 days past expiresAt — the license still works,
   *  but a renewal warning should show instead of the generic "Expired". */
  inGracePeriod?: boolean
  /** Days left before the grace window ends and the install actually locks. */
  graceDaysRemaining?: number
}

function formatBytesGb(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1024 ? `${(gb / 1024).toFixed(gb % 1024 === 0 ? 0 : 1)} TB` : `${gb.toFixed(gb % 1 === 0 ? 0 : 1)} GB`
}

import { useParams } from "next/navigation"
import { getGlobalWorkspaceIdAction } from "@/actions/tenant"

export function EnterpriseLicenseBanner({
  tenantId,
  hideActivation = false,
  hideActivateButton = false,
  scope = "tenant",
}: {
  tenantId?: string
  /** Hides the whole "no license" card (status text included) — use only where showing an
   *  enterprise-license notice at all makes no sense in that context. */
  hideActivation?: boolean
  /** Keeps the "no license" card (status text + "Hubungi Admin") but drops just the
   *  "Aktivasi Key" button/form. Use where no real tenant is in context — the button's POST
   *  needs a tenant the caller is a member of, which doesn't exist here. */
  hideActivateButton?: boolean
  /** "tenant" (default): checks/activates a specific workspace's license via
   *  /api/tenant/<id>/license/* — that workspace's plan limits (content, storage, team
   *  members) get bypassed. "user": checks/activates the CALLER's own account-level
   *  license via /api/user/license/*, which unlocks enforceUserPlanLimit()'s "workspaces"
   *  bypass (unlimited workspace creation) — see src/lib/plan-enforcement.ts's
   *  isEnterpriseTenant(userId) check. No tenant involved for this scope; tenantId/params
   *  are ignored. */
  scope?: "tenant" | "user"
}) {
  const params = useParams() as { tenant?: string }
  const { toast } = useToast()
  const [license, setLicense] = useState<EnterpriseLicenseInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [showActivate, setShowActivate] = useState(false)
  const [licenseKeyInput, setLicenseKeyInput] = useState("")
  const [activating, setActivating] = useState(false)
  const [tenant, setTenant] = useState<string>(tenantId || params.tenant || "")

  const apiBase = scope === "user" ? "/api/user/license" : null

  const fetchStatus = async () => {
    try {
      let url: string
      if (apiBase) {
        url = `${apiBase}/status`
      } else {
        let currentTenant = tenantId || params.tenant
        if (!currentTenant) {
          currentTenant = await getGlobalWorkspaceIdAction()
          setTenant(currentTenant || "")
        }
        if (!currentTenant) {
          setLicense(null)
          setLoading(false)
          return
        }
        url = `/api/tenant/${currentTenant}/license/status`
      }
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLicense(data)
      } else {
        setLicense(null)
      }
    } catch {
      setLicense(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
  }, [])

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault()
    setActivating(true)
    try {
      const res = await fetch(apiBase ? `${apiBase}/activate` : `/api/tenant/${tenant}/license/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseKey: licenseKeyInput }),
      })
      const data = await res.json()
      if (res.ok) {
        setShowActivate(false)
        setLicenseKeyInput("")
        toast({ title: "Lisensi Berhasil Diaktifkan", description: "Mode Enterprise kini telah aktif." })
        await fetchStatus()
      } else {
        toast({ title: "Aktivasi Gagal", description: data.error || "Kunci lisensi tidak valid", variant: "destructive" })
      }
    } catch {
      toast({ title: "Terjadi Kesalahan", description: "Gagal mengaktifkan lisensi", variant: "destructive" })
    } finally {
      setActivating(false)
    }
  }

  if (loading) return null
  if (!license || !license.valid) {
    if (hideActivation) return null
    return (
      <Card className="border border-border/80 bg-card/60 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-muted/80 border border-border/80 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">Mode Standar (Standard Mode)</p>
                  <Badge variant="outline" className="text-[10px] font-semibold px-2 py-0.5 rounded-full border-border">
                    Batasan Kuota Aktif
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Batasan paket workspace berlaku. Untuk mendapatkan lisensi Enterprise atau akses tanpa batas, <strong>silakan hubungi Administrator</strong>.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <a href="mailto:admin@sacms.cloud?subject=Permintaan%20Lisensi%20Enterprise%20SaCMS">
                <Button variant="outline" size="sm" className="h-8 text-xs font-semibold rounded-xl border-border">
                  <ExternalLink className="w-3 h-3 mr-1.5" />
                  Hubungi Admin
                </Button>
              </a>
              {!hideActivateButton && (
                !showActivate ? (
                  <Button variant="default" size="sm" onClick={() => setShowActivate(true)} className="h-8 text-xs font-semibold rounded-xl bg-primary text-primary-foreground">
                    <KeyRound className="w-3 h-3 mr-1.5" />
                    Aktivasi Key
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setShowActivate(false)} className="h-8 text-xs font-semibold rounded-xl">
                    Batal
                  </Button>
                )
              )}
            </div>
          </div>

          {!hideActivateButton && showActivate && (
            <form onSubmit={handleActivate} className="mt-4 pt-4 border-t border-border/80 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Serial Key Lisensi Enterprise</label>
                <Input
                  value={licenseKeyInput}
                  onChange={(e) => setLicenseKeyInput(e.target.value)}
                  placeholder="Tempelkan serial key SACMS-... yang diberikan Administrator"
                  className="font-mono text-xs rounded-xl"
                  required
                />
              </div>
              <Button type="submit" disabled={activating || !licenseKeyInput.trim()} className="w-full h-9 text-xs font-bold rounded-xl bg-primary text-primary-foreground">
                {activating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mengaktifkan...</> : "Aktifkan Lisensi Enterprise"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    )
  }

  const daysRemaining = license.daysRemaining || 0
  const isInGrace = license.inGracePeriod === true
  const isExpiring = daysRemaining < 30 && daysRemaining > 0
  // Grace period (FR-ENT-005): the license already passed expiresAt but is
  // still valid/working for 7 days — shown as its own urgent-but-not-yet-
  // locked state, distinct from the hard lockout once grace itself runs out.
  const isLockedOut = daysRemaining <= 0 && !isInGrace
  const isExpired = isLockedOut || isInGrace
  const progressPct = license.totalDays ? Math.round(((license.totalDays - daysRemaining) / license.totalDays) * 100) : 60

  return (
    <Card className={cn(
      "border-2",
      isExpired ? "border-red-500/30" : isExpiring ? "border-yellow-500/30" : "border-green-500/30"
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              isExpired ? "bg-red-500/10" : isExpiring ? "bg-yellow-500/10" : "bg-green-500/10"
            )}>
              {isExpired ? <ShieldAlert className="w-5 h-5 text-red-500" /> :
               isExpiring ? <ShieldAlert className="w-5 h-5 text-yellow-500" /> :
               <ShieldCheck className="w-5 h-5 text-green-500" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-xs font-bold",
                  isExpired ? "text-red-500" : isExpiring ? "text-yellow-500" : "text-green-500"
                )}>
                  {isInGrace ? `License Expired — ${license.graceDaysRemaining ?? 0} days left before lockout` :
                   isLockedOut ? "License Expired — Access Locked" :
                   isExpiring ? `Expiring in ${daysRemaining} days` :
                   `Enterprise License — ${daysRemaining} days remaining`}
                </span>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                  {license.type}
                </Badge>
              </div>
              <p className="text-sm font-bold mt-0.5">{license.customerName}</p>
              {license.expiresAt && (
                <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                  Activated until: {new Date(license.expiresAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </p>
              )}
            </div>
          </div>
          {(isExpiring || isInGrace) && (
            <a href="mailto:support@sacms.cloud?subject=License%20Renewal">
              <Button size="sm">Renew License</Button>
            </a>
          )}
        </div>
        {!isExpired && (
          <div className="mt-3">
            <Progress value={Math.min(progressPct, 100)} className="h-1.5" />
          </div>
        )}

        {license.storageLimitBytes != null && license.storageUsedBytes != null && (() => {
          const storagePct = license.storageLimitBytes > 0
            ? Math.round((license.storageUsedBytes / license.storageLimitBytes) * 100)
            : 0
          const storageFull = storagePct >= 100
          const storageWarning = storagePct >= 90
          return (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-bold text-foreground">
                  Storage Gabungan (Semua Workspace)
                </span>
                <span className={cn(
                  "text-[11px] font-mono font-bold",
                  storageFull ? "text-red-500" : storageWarning ? "text-yellow-500" : "text-muted-foreground"
                )}>
                  {formatBytesGb(license.storageUsedBytes)} / {formatBytesGb(license.storageLimitBytes)}
                </span>
              </div>
              <Progress
                value={Math.min(storagePct, 100)}
                className={cn("h-1.5", storageFull ? "[&>div]:bg-red-500" : storageWarning ? "[&>div]:bg-yellow-500" : undefined)}
              />
              {storageWarning && (
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-muted-foreground">
                    {storageFull
                      ? "Kuota storage gabungan sudah penuh — upload baru di semua workspace Anda bisa ditolak."
                      : "Kuota storage gabungan hampir penuh."}
                  </p>
                  <a href="mailto:admin@sacms.cloud?subject=Permintaan%20Upgrade%20Storage%20Enterprise">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold rounded-xl border-border">
                      <ExternalLink className="w-3 h-3 mr-1.5" />
                      Upgrade Storage
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )
        })()}

        {scope === "user" && license.storageLimitBytes != null && <StorageAllocationSection />}

        {license.aiCredits != null && license.aiCreditsUsed != null && (() => {
          const creditPct = license.aiCredits > 0
            ? Math.round((license.aiCreditsUsed / license.aiCredits) * 100)
            : 0
          const creditsFull = creditPct >= 100
          const creditsWarning = creditPct >= 90
          return (
            <div className="mt-4 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-bold text-foreground">
                  AI Credits (Masa Berlaku Lisensi)
                </span>
                <span className={cn(
                  "text-[11px] font-mono font-bold",
                  creditsFull ? "text-red-500" : creditsWarning ? "text-yellow-500" : "text-muted-foreground"
                )}>
                  {license.aiCreditsUsed.toLocaleString("id-ID")} / {license.aiCredits.toLocaleString("id-ID")}
                </span>
              </div>
              <Progress
                value={Math.min(creditPct, 100)}
                className={cn("h-1.5", creditsFull ? "[&>div]:bg-red-500" : creditsWarning ? "[&>div]:bg-yellow-500" : undefined)}
              />
              {creditsWarning && (
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-[11px] text-muted-foreground">
                    {creditsFull
                      ? "AI credits lisensi Anda sudah habis — berlangganan lagi untuk melanjutkan generate AI."
                      : "AI credits lisensi Anda hampir habis."}
                  </p>
                  <a href="mailto:admin@sacms.cloud?subject=Perpanjangan%20AI%20Credits%20Enterprise">
                    <Button variant="outline" size="sm" className="h-7 text-[11px] font-semibold rounded-xl border-border">
                      <ExternalLink className="w-3 h-3 mr-1.5" />
                      Berlangganan Lagi
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )
        })()}
      </CardContent>
    </Card>
  )
}

interface StorageAllocationWorkspace {
  tenantId: string
  name: string
  slug: string
  allocatedBytes: number
  isExplicit: boolean
  usedBytes: number
  addonBytes: number
  effectiveLimitBytes: number
}

interface StorageAllocationResponse {
  licensed: boolean
  poolLimitBytes?: number
  poolUsedBytes?: number
  overAllocated?: boolean
  workspaces?: StorageAllocationWorkspace[]
}

/**
 * Lets the account owner split their pooled Enterprise storage grant across
 * specific owned workspaces (give one workspace a fixed GB figure, the rest
 * auto-split whatever's left — see getOwnerStorageAllocationPlan() in
 * plan-enforcement.ts) instead of every workspace silently sharing one
 * combined number. Fetches lazily, only once expanded, since the backing
 * endpoint does an N-tenant fan-out this banner's cheap default load
 * shouldn't pay for on every dashboard mount.
 */
function StorageAllocationSection() {
  const { toast } = useToast()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StorageAllocationResponse | null>(null)
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null)

  const fetchAllocations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/user/storage-allocations")
      if (res.ok) setData(await res.json())
    } catch {
      // Section just stays empty — the combined storage bar above still works.
    } finally {
      setLoading(false)
    }
  }

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && !data) fetchAllocations()
  }

  const handleSave = async (tenantId: string) => {
    const allocatedGb = Number(editValue)
    if (!Number.isInteger(allocatedGb) || allocatedGb <= 0) {
      toast({ variant: "destructive", title: "Nilai Tidak Valid", description: "Masukkan jumlah GB berupa bilangan bulat lebih dari 0." })
      return
    }
    setSavingTenantId(tenantId)
    try {
      const res = await fetch(`/api/user/storage-allocations/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocatedGb }),
      })
      const body = await res.json()
      if (res.ok) {
        toast({ title: "Alokasi Disimpan", description: `Workspace ini kini mendapat ${allocatedGb} GB.` })
        setEditingTenantId(null)
        await fetchAllocations()
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: body.error || "Gagal menyimpan alokasi." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal menyimpan alokasi." })
    } finally {
      setSavingTenantId(null)
    }
  }

  const handleReset = async (tenantId: string) => {
    setSavingTenantId(tenantId)
    try {
      const res = await fetch(`/api/user/storage-allocations/${tenantId}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Dikembalikan ke Otomatis", description: "Workspace ini kini mendapat bagian rata dari sisa kuota." })
        await fetchAllocations()
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal mengembalikan ke alokasi otomatis." })
      }
    } catch {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal mengembalikan ke alokasi otomatis." })
    } finally {
      setSavingTenantId(null)
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-border/60">
      <button
        type="button"
        onClick={handleExpand}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="text-[11px] font-bold text-foreground">Alokasi Storage per Workspace</span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat alokasi...
            </div>
          ) : !data?.licensed || !data.workspaces?.length ? (
            <p className="text-xs text-muted-foreground py-1">Belum ada workspace untuk dialokasikan.</p>
          ) : (
            <>
              {data.overAllocated && (
                <div className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  Total alokasi manual melebihi kuota lisensi — kurangi salah satu alokasi di bawah.
                </div>
              )}
              {data.workspaces.map((w) => {
                const pct = w.effectiveLimitBytes > 0 ? Math.round((w.usedBytes / w.effectiveLimitBytes) * 100) : 0
                const full = pct >= 100
                const warning = pct >= 90
                const isEditing = editingTenantId === w.tenantId
                const isSaving = savingTenantId === w.tenantId

                return (
                  <div key={w.tenantId} className="rounded-xl border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{w.name}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-semibold px-1.5 py-0 rounded-full",
                            w.isExplicit ? "border-primary/30 text-primary" : "border-border text-muted-foreground"
                          )}
                        >
                          {w.isExplicit ? "Manual" : "Otomatis"}
                        </Badge>
                      </div>

                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={1}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-7 w-20 text-xs rounded-lg"
                            disabled={isSaving}
                          />
                          <span className="text-[10px] text-muted-foreground">GB</span>
                          <Button size="sm" className="h-7 px-2 text-[11px] rounded-lg" disabled={isSaving} onClick={() => handleSave(w.tenantId)}>
                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] rounded-lg" disabled={isSaving} onClick={() => setEditingTenantId(null)}>
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] rounded-lg border-border"
                            disabled={isSaving}
                            onClick={() => {
                              setEditingTenantId(w.tenantId)
                              setEditValue(String(Math.max(1, Math.round(w.allocatedBytes / (1024 * 1024 * 1024)))))
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            {w.isExplicit ? "Ubah" : "Atur Manual"}
                          </Button>
                          {w.isExplicit && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] rounded-lg"
                              disabled={isSaving}
                              onClick={() => handleReset(w.tenantId)}
                            >
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatBytesGb(w.usedBytes)} / {formatBytesGb(w.effectiveLimitBytes)}
                          {w.addonBytes > 0 && <span className="ml-1">(termasuk +{formatBytesGb(w.addonBytes)} add-on)</span>}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        className={cn("h-1", full ? "[&>div]:bg-red-500" : warning ? "[&>div]:bg-yellow-500" : undefined)}
                      />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
