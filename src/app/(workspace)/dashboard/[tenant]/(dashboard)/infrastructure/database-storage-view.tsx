"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { checkEnterpriseModeAction } from "@/actions/billing"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Activity,
  CheckCircle2,
  RefreshCw,
  HardDrive,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export function DatabaseStorageView({ tenantSlug }: { tenantSlug: string }) {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  // Every tenant is always on SaCMS's own shared infrastructure — the only
  // exception is a workspace owned by an Enterprise-licensed account, which
  // transparently routes to that account's dedicated SaCMS-hosted database
  // (see getOwnerMasterInfra() in src/lib/database.ts, auto-provisioned on
  // license activation — never something this workspace connects itself).
  const [isEnterpriseWorkspace, setIsEnterpriseWorkspace] = useState(false)

  useEffect(() => {
    if (tenantSlug && session?.user) {
      checkEnterpriseModeAction(tenantSlug).then(setIsEnterpriseWorkspace).catch(() => {})
    }
  }, [tenantSlug, session])

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [authStatus, router])

  useEffect(() => {
    if (tenantSlug && session?.user) {
      setLoading(false)
    }
  }, [tenantSlug, session])

  const [storageAddons, setStorageAddons] = useState<
    { id: string; bytes: number; startsAt: string; expiresAt: string; renewed: boolean }[]
  >([])
  useEffect(() => {
    if (!tenantSlug || !session?.user) return
    fetch(`/api/tenant/${tenantSlug}/billing/services`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setStorageAddons(data?.storageAddons ?? [])
      })
      .catch(() => {})
  }, [tenantSlug, session])

  // Storage tiers (5/10/20/50/100GB, 1TB) are CMS-driven, not fixed ids —
  // fetched here only to resolve which tier id a "Perpanjang" button should
  // renew with (matched by byte size), never hardcoded.
  const [storageTiers, setStorageTiers] = useState<{ id: string; amountUnits?: number }[]>([])
  useEffect(() => {
    if (!tenantSlug || !session?.user) return
    fetch(`/api/tenant/${tenantSlug}/subscriptions/plans`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const tiers = (data?.plans || []).filter((p: any) => p.type === "addons" && p.quotaType === "storage")
        setStorageTiers(tiers)
      })
      .catch(() => {})
  }, [tenantSlug, session])

  const matchingTierId = (bytes: number) => storageTiers.find((t) => t.amountUnits === bytes)?.id

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-72 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-96 max-w-full rounded-md mt-2" />
          </CardHeader>
          <CardContent className="p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="h-5 w-40 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Status Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 px-4 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          {isEnterpriseWorkspace ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-bold rounded-full flex items-center gap-1.5 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Database Khusus Enterprise
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-xs font-bold rounded-full flex items-center gap-1.5 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Shared Multi-Tenant Pool
            </Badge>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              setIsEnterpriseWorkspace(await checkEnterpriseModeAction(tenantSlug).catch(() => false))
              toast.success("Status infrastruktur diperbarui")
            }}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-6 animate-in fade-in-50 duration-300">
        {/* 1. ACTIVE CLUSTER STATUS OVERVIEW CARD */}
        <Card className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden">
          <CardHeader className="p-5 pb-3 bg-muted/20 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" />
                Status Lingkungan Basis Data Saat Ini
              </CardTitle>
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {isEnterpriseWorkspace ? "Dedicated Server Beroperasi" : "Shared Pool Beroperasi Normal"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipe Database</span>
                <p className="text-xs font-bold text-foreground">
                  {isEnterpriseWorkspace ? "Database Terisolasi" : "Database Bersama"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isEnterpriseWorkspace ? "Dedicated Enterprise Engine" : "Shared Multi-Tenant Engine"}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Object Storage</span>
                <p className="text-xs font-bold text-foreground">Storage Bersama SaCMS</p>
                <p className="text-[11px] text-muted-foreground">Kuota dihitung per workspace</p>
              </div>
              <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Isolasi Keamanan</span>
                <p className="text-xs font-bold text-foreground">
                  {isEnterpriseWorkspace ? "Physical & Logical Isolation" : "Tenant Logical Scoping"}
                </p>
                <p className="text-[11px] text-muted-foreground">Enkripsi Data In-Transit &amp; At-Rest</p>
              </div>
              <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alokasi Resource</span>
                <p className="text-xs font-bold text-foreground">
                  {isEnterpriseWorkspace ? "Dedicated Hardware" : "Shared Pool SaCMS"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isEnterpriseWorkspace ? "Zero Noisy Neighbor" : "Aplikasi dan API SaCMS bersama"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. STORAGE ADD-ON CARD */}
        <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-primary" />
              Tambah Kapasitas Storage
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Butuh ruang lebih untuk media workspace ini? Tambah kapasitas langsung dari SaCMS, berlaku 1 tahun dan aktif seketika setelah pembayaran.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-3">
            <p className="text-xs text-foreground">
              Mulai dari <span className="font-bold">5 GB</span> hingga <span className="font-bold">1 TB</span>, sekali bayar untuk <span className="font-bold">1 tahun</span> &middot; bisa dibeli berkali-kali
            </p>
            {storageAddons.length > 0 ? (
              <div className="space-y-2">
                {storageAddons.map((addon) => {
                  const renewPlanId = matchingTierId(addon.bytes)
                  const renewHref = renewPlanId
                    ? `/dashboard/${tenantSlug}/subscriptions/checkout?plan=${renewPlanId}&renew=${addon.id}`
                    : `/dashboard/${tenantSlug}/subscriptions?tab=storage`
                  return (
                    <div key={addon.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-muted/30 border border-border/60">
                      <div>
                        <p className="font-semibold text-foreground">+{Math.round(addon.bytes / 1024 ** 3)} GB</p>
                        <p className="text-muted-foreground">
                          Berlaku sampai{" "}
                          {new Date(addon.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      {addon.renewed ? (
                        <span className="text-muted-foreground">Sudah diperpanjang</span>
                      ) : (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-xl h-8 text-xs font-bold shrink-0"
                        >
                          <Link href={renewHref}>Perpanjang</Link>
                        </Button>
                      )}
                    </div>
                  )
                })}
                <Button asChild size="sm" className="rounded-xl h-8 text-xs font-bold">
                  <Link href={`/dashboard/${tenantSlug}/subscriptions?tab=storage`}>
                    Beli Storage Lagi
                  </Link>
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-bold">
                <Link href={`/dashboard/${tenantSlug}/subscriptions?tab=storage`}>
                  Beli Storage Tambahan
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
