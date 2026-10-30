"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { checkEnterpriseModeAction } from "@/actions/billing"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Activity,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  Server,
  Loader2,
  Database,
  Save,
  Trash2,
  PlugZap,
  XCircle,
  Lock,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const MASK = "••••••••"
type TestResult = { status: "idle" | "success" | "error"; message?: string }

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

  // Owner-only per-workspace switch: use the owner's own BYODB/BYOS, or
  // stay on SaCMS's dedicated DB / Enterprise storage pool. Only rendered
  // when the owner actually has infra configured (see
  // GET /api/tenant/[tenant]/infrastructure's ownerHasInfraConfigured).
  const tenantMembership = (session?.user as any)?.tenants?.find((t: any) => t.slug === tenantSlug || t.id === tenantSlug)
  const isOwner = tenantMembership?.role === "owner"
  const [ownerHasInfraConfigured, setOwnerHasInfraConfigured] = useState(false)
  const [useOwnerInfra, setUseOwnerInfra] = useState(true)
  const [switchingInfra, setSwitchingInfra] = useState(false)

  // Workspace-plan-gated BYODB/BYOS for THIS tenant directly (Tenant.databaseUrl
  // / storageConfig) — distinct from the owner's account-level BYODB above.
  // Unlocked by Tenant.plan "business"/"enterprise" or the owner's Enterprise
  // License (isWorkspaceEligibleForByoInfra in src/lib/database.ts), not the
  // owner's account plan.
  const [workspaceEligible, setWorkspaceEligible] = useState(false)
  const [tenantDbUrl, setTenantDbUrl] = useState("")
  const [tenantEndpoint, setTenantEndpoint] = useState("")
  const [tenantAccessKey, setTenantAccessKey] = useState("")
  const [tenantSecretKey, setTenantSecretKey] = useState("")
  const [tenantBucket, setTenantBucket] = useState("")
  const [savingTenantDb, setSavingTenantDb] = useState(false)
  const [savingTenantStorage, setSavingTenantStorage] = useState(false)
  const [testingTenantDb, setTestingTenantDb] = useState(false)
  const [testingTenantStorage, setTestingTenantStorage] = useState(false)
  const [tenantDbTestResult, setTenantDbTestResult] = useState<TestResult>({ status: "idle" })
  const [tenantStorageTestResult, setTenantStorageTestResult] = useState<TestResult>({ status: "idle" })

  useEffect(() => {
    if (!tenantSlug || !session?.user || !isOwner) return
    fetch(`/api/tenant/${tenantSlug}/infrastructure`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return
        setOwnerHasInfraConfigured(!!data.ownerHasInfraConfigured)
        setUseOwnerInfra(data.useOwnerInfra !== false)
        setWorkspaceEligible(!!data.workspaceEligibleForByoInfra)
        setTenantDbUrl(data.tenantDatabaseUrl || "")
        if (data.tenantStorageConfig) {
          setTenantEndpoint(data.tenantStorageConfig.endpoint || "")
          setTenantAccessKey(data.tenantStorageConfig.accessKey || "")
          setTenantSecretKey(data.tenantStorageConfig.secretKey || "")
          setTenantBucket(data.tenantStorageConfig.bucket || "")
        }
      })
      .catch(() => {})
  }, [tenantSlug, session, isOwner])

  const saveTenantDbUrl = async (value: string | null) => {
    setSavingTenantDb(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/infrastructure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ databaseUrl: value }),
      })
      const body = await res.json()
      if (res.ok) {
        setTenantDbUrl(value || "")
        setTenantDbTestResult({ status: "idle" })
        toast.success(value ? "URL database workspace berhasil disimpan." : "Database sendiri dihapus — workspace kembali ke sumber infrastruktur lain.")
      } else {
        toast.error(body.error || "Gagal menyimpan URL database.")
      }
    } catch {
      toast.error("Gagal menyimpan URL database.")
    } finally {
      setSavingTenantDb(false)
    }
  }

  const saveTenantStorageConfig = async (
    value: { endpoint: string; accessKey: string; secretKey: string; bucket: string } | null
  ) => {
    setSavingTenantStorage(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/infrastructure`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageConfig: value }),
      })
      const body = await res.json()
      if (res.ok) {
        if (!value) {
          setTenantEndpoint("")
          setTenantAccessKey("")
          setTenantSecretKey("")
          setTenantBucket("")
        }
        setTenantStorageTestResult({ status: "idle" })
        toast.success(value ? "Konfigurasi storage workspace berhasil disimpan." : "Storage sendiri dihapus — workspace kembali ke sumber infrastruktur lain.")
      } else {
        toast.error(body.error || "Gagal menyimpan konfigurasi storage.")
      }
    } catch {
      toast.error("Gagal menyimpan konfigurasi storage.")
    } finally {
      setSavingTenantStorage(false)
    }
  }

  const handleSaveTenantDb = () => {
    const trimmed = tenantDbUrl.trim()
    saveTenantDbUrl(trimmed === "" ? null : trimmed)
  }

  const handleSaveTenantStorage = () => {
    if (!tenantEndpoint.trim() || !tenantAccessKey.trim() || !tenantSecretKey.trim() || !tenantBucket.trim()) {
      toast.error("Isi Endpoint, Access Key, Secret Key, dan Bucket.")
      return
    }
    saveTenantStorageConfig({ endpoint: tenantEndpoint.trim(), accessKey: tenantAccessKey.trim(), secretKey: tenantSecretKey, bucket: tenantBucket.trim() })
  }

  const handleTestTenantDb = async () => {
    if (!tenantDbUrl.trim() || tenantDbUrl === MASK) return
    setTestingTenantDb(true)
    setTenantDbTestResult({ status: "idle" })
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/infrastructure/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "database", url: tenantDbUrl.trim() }),
      })
      const body = await res.json()
      setTenantDbTestResult({ status: res.ok && body.success ? "success" : "error", message: body.message || body.error })
    } catch {
      setTenantDbTestResult({ status: "error", message: "Gagal menghubungi server untuk tes koneksi." })
    } finally {
      setTestingTenantDb(false)
    }
  }

  const handleTestTenantStorage = async () => {
    if (!tenantEndpoint.trim() || !tenantAccessKey.trim() || !tenantSecretKey.trim() || !tenantBucket.trim()) {
      toast.error("Isi Endpoint, Access Key, Secret Key, dan Bucket sebelum tes koneksi.")
      return
    }
    setTestingTenantStorage(true)
    setTenantStorageTestResult({ status: "idle" })
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/infrastructure/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "storage",
          config: { endpoint: tenantEndpoint.trim(), accessKey: tenantAccessKey.trim(), secretKey: tenantSecretKey, bucket: tenantBucket.trim() },
        }),
      })
      const body = await res.json()
      setTenantStorageTestResult({ status: res.ok && body.success ? "success" : "error", message: body.message || body.error })
    } catch {
      setTenantStorageTestResult({ status: "error", message: "Gagal menghubungi server untuk tes koneksi." })
    } finally {
      setTestingTenantStorage(false)
    }
  }

  const TenantTestResultBadge = ({ result }: { result: TestResult }) => {
    if (result.status === "idle") return null
    const ok = result.status === "success"
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs",
          ok
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
        )}
      >
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />}
        <span>{result.message || (ok ? "Koneksi berhasil." : "Koneksi gagal.")}</span>
      </div>
    )
  }

  const handleToggleOwnerInfra = async (next: boolean) => {
    setSwitchingInfra(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/infrastructure`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ useOwnerInfra: next }),
      })
      const body = await res.json()
      if (res.ok) {
        setUseOwnerInfra(next)
        setIsEnterpriseWorkspace(await checkEnterpriseModeAction(tenantSlug).catch(() => false))
        toast.success(next ? "Workspace ini kini memakai server Anda sendiri." : "Workspace ini kini memakai SaCMS kembali.")
      } else {
        toast.error(body.error || "Gagal mengubah sumber infrastruktur")
      }
    } catch {
      toast.error("Terjadi kesalahan")
    } finally {
      setSwitchingInfra(false)
    }
  }

  // Safety gate for turning "Sumber Infrastruktur Workspace Ini" ON: the
  // user must have already clicked "Tes Koneksi" and gotten success for
  // BOTH the database and storage fields in the BYODB card below (editing
  // either field resets its result to "idle", so a stale pass doesn't
  // count), then type an exact confirmation phrase — so a careless click
  // can never silently move this workspace onto someone else's server.
  // Turning it OFF (back to SaCMS) stays unconditional, same as before.
  const CONFIRM_PHRASE = "GUNAKAN SERVER SENDIRI"
  const bothTenantTestsPassed = tenantDbTestResult.status === "success" && tenantStorageTestResult.status === "success"
  const [confirmSwitchOpen, setConfirmSwitchOpen] = useState(false)
  const [confirmPhraseInput, setConfirmPhraseInput] = useState("")

  const handleSwitchChange = (next: boolean) => {
    if (!next) {
      handleToggleOwnerInfra(false)
      return
    }
    if (!bothTenantTestsPassed) {
      toast.error("Tes Koneksi Database dan Storage pada card di bawah harus sukses terlebih dahulu sebelum mengaktifkan ini.")
      return
    }
    setConfirmPhraseInput("")
    setConfirmSwitchOpen(true)
  }

  const handleConfirmSwitchOn = () => {
    setConfirmSwitchOpen(false)
    handleToggleOwnerInfra(true)
  }

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

        {/* 1a. OWNER-ONLY SWITCH: own infra vs SaCMS-managed */}
        {isOwner && ownerHasInfraConfigured && (
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Server className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Sumber Infrastruktur Workspace Ini</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-md">
                    Anda sudah mengatur database/storage sendiri di halaman Infrastruktur. Pilih apakah workspace ini memakainya, atau tetap memakai SaCMS (database/storage khusus Enterprise Anda tidak hilang, hanya tidak dipakai workspace ini).
                  </p>
                  {tenantDbUrl && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 max-w-md">
                      Workspace ini memakai database sendiri langsung (di bawah) — switch ini tidak berpengaruh selama database sendiri tersebut aktif.
                    </p>
                  )}
                  {!useOwnerInfra && !bothTenantTestsPassed && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 max-w-md italic">
                      Tes Koneksi Database &amp; Storage pada card di bawah harus sukses dulu sebelum switch ini bisa diaktifkan.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Label htmlFor="use-owner-infra" className="text-[11px] font-semibold text-muted-foreground">
                  {useOwnerInfra ? "Server Sendiri" : "SaCMS"}
                </Label>
                {switchingInfra ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <Switch id="use-owner-infra" checked={useOwnerInfra} onCheckedChange={handleSwitchChange} />
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Typed-confirmation dialog — required before turning "Sumber Infrastruktur
            Workspace Ini" ON, so a careless click can't move this workspace onto
            someone else's server without a deliberate, explicit acknowledgment. */}
        <Dialog open={confirmSwitchOpen} onOpenChange={setConfirmSwitchOpen}>
          <DialogContent className="rounded-2xl border border-border bg-card">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Konfirmasi Penggunaan Server Sendiri
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Workspace ini akan beralih memakai database &amp; storage server Anda sendiri, bukan infrastruktur SaCMS. Untuk melanjutkan, ketik persis kalimat berikut:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs font-mono font-bold text-center p-2.5 rounded-lg bg-muted/50 border border-border/70 select-all">
                {CONFIRM_PHRASE}
              </p>
              <Input
                value={confirmPhraseInput}
                onChange={(e) => setConfirmPhraseInput(e.target.value)}
                placeholder="Ketik konfirmasi di sini"
                className="text-xs"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setConfirmSwitchOpen(false)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="text-xs font-bold"
                onClick={handleConfirmSwitchOn}
                disabled={confirmPhraseInput.trim() !== CONFIRM_PHRASE}
              >
                Aktifkan Server Sendiri
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 1b. WORKSPACE-PLAN-GATED BYODB/BYOS: this tenant's own direct database/storage */}
        {isOwner && (
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Database &amp; Storage Sendiri Workspace Ini
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Hubungkan PostgreSQL dan storage MinIO/S3 milik Anda sendiri (VPS/server sendiri) khusus untuk workspace ini.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {!workspaceEligible ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs text-amber-700 dark:text-amber-400">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Fitur ini tersedia untuk workspace dengan paket <strong>Business</strong> atau akun dengan <strong>lisensi Enterprise</strong>.{" "}
                    <Link href={`/dashboard/${tenantSlug}/subscriptions`} className="underline font-semibold">
                      Upgrade paket workspace
                    </Link>{" "}
                    untuk membuka fitur ini.
                  </span>
                </div>
              ) : (
                <>
                  {/* Database */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">URL Database PostgreSQL</Label>
                    <Input
                      type="text"
                      placeholder="postgresql://user:password@host:5432/dbname"
                      value={tenantDbUrl}
                      onChange={(e) => {
                        setTenantDbUrl(e.target.value)
                        setTenantDbTestResult({ status: "idle" })
                      }}
                      className="font-mono text-xs"
                      disabled={savingTenantDb || testingTenantDb}
                    />
                    <TenantTestResultBadge result={tenantDbTestResult} />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => saveTenantDbUrl(null)} disabled={savingTenantDb || tenantDbUrl === ""}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Hapus
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleTestTenantDb} disabled={testingTenantDb || !tenantDbUrl.trim() || tenantDbUrl === MASK}>
                        {testingTenantDb ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
                        Tes Koneksi
                      </Button>
                      <Button size="sm" onClick={handleSaveTenantDb} disabled={savingTenantDb || tenantDbUrl === MASK}>
                        {savingTenantDb ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Simpan
                      </Button>
                    </div>
                  </div>

                  {/* Storage */}
                  <div className="space-y-2 pt-4 border-t border-border/60">
                    <Label className="text-xs font-bold">Storage MinIO/S3</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Endpoint MinIO</Label>
                        <Input
                          placeholder="https://minio.domain-anda.com"
                          value={tenantEndpoint}
                          onChange={(e) => {
                            setTenantEndpoint(e.target.value)
                            setTenantStorageTestResult({ status: "idle" })
                          }}
                          className="text-xs"
                          disabled={savingTenantStorage || testingTenantStorage}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Access Key</Label>
                        <Input value={tenantAccessKey} onChange={(e) => setTenantAccessKey(e.target.value)} className="text-xs" disabled={savingTenantStorage || testingTenantStorage} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Secret Key</Label>
                        <Input type="password" value={tenantSecretKey} onChange={(e) => setTenantSecretKey(e.target.value)} className="text-xs" disabled={savingTenantStorage || testingTenantStorage} />
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-[11px] font-semibold text-muted-foreground">Nama Bucket</Label>
                        <Input value={tenantBucket} onChange={(e) => setTenantBucket(e.target.value)} className="text-xs" disabled={savingTenantStorage || testingTenantStorage} />
                      </div>
                    </div>
                    <TenantTestResultBadge result={tenantStorageTestResult} />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => saveTenantStorageConfig(null)} disabled={savingTenantStorage || !tenantEndpoint}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        Hapus
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleTestTenantStorage} disabled={testingTenantStorage}>
                        {testingTenantStorage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5 mr-1.5" />}
                        Tes Koneksi
                      </Button>
                      <Button size="sm" onClick={handleSaveTenantStorage} disabled={savingTenantStorage}>
                        {savingTenantStorage ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                        Simpan
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

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
