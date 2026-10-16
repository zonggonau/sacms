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
  const isExpiring = daysRemaining < 30 && daysRemaining > 0
  const isExpired = daysRemaining <= 0
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
                  {isExpired ? "License Expired" : 
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
          {isExpiring && (
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
