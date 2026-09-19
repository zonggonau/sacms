"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Server,
  Database,
  Upload,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Cpu,
  HardDrive,
  Lock,
  Save,
  Zap,
  ArrowRight,
  Sparkles,
  Layers,
  Check,
  X,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Settings2,
  Power,
  Clock,
  Radio,
  Share2,
  Ticket,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getUserVpsServicesAction,
  assignVpsToWorkspaceAction,
  disconnectVpsFromWorkspaceAction,
} from "@/actions/vps-service"

export function DatabaseStorageView({ tenantSlug }: { tenantSlug: string }) {
  const { data: session, status: authStatus } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tenantSettings, setTenantSettings] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "console">("overview")

  // BYODB & BYOS State
  const [databaseUrl, setDatabaseUrl] = useState("")
  const [storageEndpoint, setStorageEndpoint] = useState("")
  const [storageAccessKey, setStorageAccessKey] = useState("")
  const [storageSecretKey, setStorageSecretKey] = useState("")
  const [storageBucket, setStorageBucket] = useState("")
  const [storagePublicUrl, setStoragePublicUrl] = useState("")

  // VPS Lifecycle State
  const [userVpsList, setUserVpsList] = useState<any[]>([])
  const [loadingVps, setLoadingVps] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedVpsToDisconnect, setSelectedVpsToDisconnect] = useState<any>(null)

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      router.push("/login")
    }
  }, [authStatus, router])

  const fetchInfrastructure = async () => {
    if (!tenantSlug) return
    try {
      const settingsRes = await fetch(`/api/tenant/${tenantSlug}/settings`)

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        const s = settingsData.settings || {}
        setTenantSettings(s)
        const dbUrl = s.databaseUrl || ""
        setDatabaseUrl(dbUrl)
        if (s.storageConfig) {
          setStorageEndpoint(s.storageConfig.endpoint || "")
          setStorageAccessKey(s.storageConfig.accessKey || "")
          setStorageSecretKey(s.storageConfig.secretKey || "")
          setStorageBucket(s.storageConfig.bucket || "")
          setStoragePublicUrl(s.storageConfig.publicUrl || "")
        }
      }
    } catch {
      toast.error("Gagal memuat konfigurasi infrastruktur")
    } finally {
      setLoading(false)
    }
  }

  const fetchVpsServices = async () => {
    try {
      setLoadingVps(true)
      const res = await getUserVpsServicesAction()
      if (res.success && res.services) {
        setUserVpsList(res.services)
      }
    } catch (err) {
      console.error("Error fetching user VPS services:", err)
    } finally {
      setLoadingVps(false)
    }
  }

  useEffect(() => {
    if (tenantSlug && session?.user) {
      fetchInfrastructure()
      fetchVpsServices()
    }
  }, [tenantSlug, session])

  const handleSaveConfig = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseUrl: databaseUrl.trim() === "" ? null : databaseUrl.trim(),
          storageConfig:
            storageEndpoint && storageAccessKey && storageSecretKey && storageBucket
              ? {
                  endpoint: storageEndpoint,
                  accessKey: storageAccessKey,
                  secretKey: storageSecretKey,
                  bucket: storageBucket,
                  publicUrl: storagePublicUrl,
                }
              : null,
        }),
      })

      if (res.ok) {
        toast.success("Konfigurasi infrastruktur berhasil disimpan!")
        fetchInfrastructure()
      } else {
        const data = await res.json()
        toast.error(data.error || "Gagal menyimpan konfigurasi")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan")
    } finally {
      setSaving(false)
    }
  }

  // Connect ready VPS to current workspace
  const handleAssignVps = async (vpsId: string) => {
    if (!tenantSettings?.id && !tenantSlug) return
    setActionLoading(true)
    try {
      const targetId = tenantSettings?.id || tenantSlug
      const res = await assignVpsToWorkspaceAction({
        serviceId: vpsId,
        tenantId: targetId,
      })

      if (res.success) {
        toast.success(res.message || "Server VPS berhasil dihubungkan ke workspace ini!")
        await Promise.all([fetchInfrastructure(), fetchVpsServices()])
        router.refresh()
      } else {
        toast.error(res.error || "Gagal menghubungkan VPS ke workspace")
      }
    } catch {
      toast.error("Terjadi kesalahan saat menghubungkan VPS")
    } finally {
      setActionLoading(false)
    }
  }

  // Disconnect VPS from current workspace (revert to shared pool)
  const handleDisconnectVps = async () => {
    if (!selectedVpsToDisconnect) return
    setActionLoading(true)
    try {
      const res = await disconnectVpsFromWorkspaceAction({
        serviceId: selectedVpsToDisconnect.id,
      })

      if (res.success) {
        toast.success("Sambungan VPS diputuskan. Workspace kembali ke Shared Multi-Tenant Pool.")
        setSelectedVpsToDisconnect(null)
        await Promise.all([fetchInfrastructure(), fetchVpsServices()])
        router.refresh()
      } else {
        toast.error(res.error || "Gagal memutuskan sambungan VPS")
      }
    } catch {
      toast.error("Terjadi kesalahan saat memutuskan sambungan VPS")
    } finally {
      setActionLoading(false)
    }
  }

  const isSuperAdmin = session?.user?.role === "super_admin"

  const [managedInfra, setManagedInfra] = useState<{ status: string; paidUntil: string } | null>(null)
  useEffect(() => {
    if (!tenantSlug || !session?.user) return
    fetch(`/api/tenant/${tenantSlug}/billing/services`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setManagedInfra(data?.managedInfra ?? null))
      .catch(() => {})
  }, [tenantSlug, session])

  // Identifikasi status VPS untuk workspace ini
  const activeVpsForThisWorkspace = userVpsList.find(
    (v) =>
      v.status === "in_use" &&
      (v.tenantId === tenantSettings?.id ||
        v.tenant?.slug === tenantSlug ||
        (v.databaseUrl && v.databaseUrl === databaseUrl))
  )

  const readyVpsList = userVpsList.filter((v) => v.status === "ready")
  const awaitingVpsList = userVpsList.filter((v) => v.status === "awaiting_setup")
  const hasDedicated = Boolean(databaseUrl && databaseUrl.trim() !== "") || Boolean(activeVpsForThisWorkspace)

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
      {/* Top Status & Controls Toolbar (No double H2) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-3 px-4 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2.5">
          {activeVpsForThisWorkspace ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-bold rounded-full flex items-center gap-1.5 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Dedicated VPS: {activeVpsForThisWorkspace.serverName}
            </Badge>
          ) : hasDedicated ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs font-bold rounded-full flex items-center gap-1.5 py-1 px-3">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Database Sendiri (BYODB)
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
              await Promise.all([fetchInfrastructure(), fetchVpsServices()])
              toast.success("Status infrastruktur diperbarui")
            }}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loadingVps ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Action Controls & Tab Switcher (Super Admin only for manual console) */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "overview"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Status
                </span>
              </button>
              <button
                onClick={() => setActiveTab("console")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeTab === "console"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Console IT Support
                </span>
              </button>
            </div>

            {activeTab === "console" && (
              <Button
                onClick={handleSaveConfig}
                disabled={saving}
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 rounded-xl shadow-xs cursor-pointer gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Simpan
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: OVERVIEW & VPS LIFECYCLE MANAGEMENT                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {(activeTab === "overview" || !isSuperAdmin) && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          {/* 1. DEDICATED VPS LIFECYCLE INTEGRATION SECTION */}
          {activeVpsForThisWorkspace ? (
            /* STATE A: WORKSPACE IS ACTIVELY CONNECTED TO VPS */
            <Card className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-primary/20 bg-primary/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-black tracking-tight text-foreground">
                          Dedicated Server VPS Terhubung
                        </CardTitle>
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Aktif Digunakan
                        </Badge>
                      </div>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Database dan konten workspace ini terisolasi secara fisik pada instans server khusus.
                      </CardDescription>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVpsToDisconnect(activeVpsForThisWorkspace)}
                    disabled={actionLoading}
                    className="rounded-xl h-8 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive self-start sm:self-center"
                  >
                    <Power className="h-3.5 w-3.5 mr-1.5" />
                    Putuskan Sambungan
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nama Server</span>
                    <p className="text-xs font-bold text-foreground truncate">{activeVpsForThisWorkspace.serverName}</p>
                    <p className="text-[11px] text-primary font-medium">{activeVpsForThisWorkspace.planName}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IP Server Gateway</span>
                    <p className="text-xs font-mono font-bold text-foreground">{activeVpsForThisWorkspace.serverIp || "Terkonfigurasi"}</p>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Port 5432 Enkripsi SSL
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engine Basis Data</span>
                    <p className="text-xs font-bold text-foreground">PostgreSQL 17 Terisolasi</p>
                    <p className="text-[11px] text-muted-foreground">Dedicated Connection Pool</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Periode Aktif</span>
                    <p className="text-xs font-bold text-foreground">
                      {new Date(activeVpsForThisWorkspace.paidUntil).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      Siklus {activeVpsForThisWorkspace.billingCycle === "yearly" ? "Tahunan" : "Bulanan"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : readyVpsList.length > 0 ? (
            /* STATE B: USER HAS A VPS CONFIGURED BY IT, READY TO BE INTEGRATED */
            <div className="space-y-4">
              {readyVpsList.map((readyVps) => (
                <Card
                  key={readyVps.id}
                  className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card to-card shadow-sm overflow-hidden"
                >
                  <CardHeader className="p-5 pb-3 border-b border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-black tracking-tight text-foreground">
                              Server VPS Siap Dihubungkan!
                            </CardTitle>
                            <Badge className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Setup IT Selesai
                            </Badge>
                          </div>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5">
                            Tim IT SaCMS telah menyiapkan server {readyVps.serverName}. Anda dapat mengintegrasikannya ke workspace ini sekarang.
                          </CardDescription>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleAssignVps(readyVps.id)}
                        disabled={actionLoading}
                        className="rounded-xl h-9 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs self-start sm:self-center gap-1.5 cursor-pointer"
                      >
                        {actionLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" />
                        )}
                        Hubungkan ke Workspace Ini
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-3 rounded-xl bg-background border border-border/80 space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Server & Paket</span>
                        <p className="text-xs font-bold text-foreground">{readyVps.serverName}</p>
                        <p className="text-[11px] text-muted-foreground">{readyVps.planName}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border/80 space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">IP Gateway</span>
                        <p className="text-xs font-mono font-bold text-foreground">{readyVps.serverIp || "Terkonfigurasi"}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">PostgreSQL 17 Ready</p>
                      </div>
                      <div className="p-3 rounded-xl bg-background border border-border/80 space-y-1">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">Tindakan</span>
                        <p className="text-xs font-bold text-foreground">Klik &quot;Hubungkan&quot; di atas</p>
                        <p className="text-[11px] text-muted-foreground">Koneksi dialihkan otomatis tanpa jeda</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : awaitingVpsList.length > 0 ? (
            /* STATE C: USER HAS ORDERED A VPS, IT SUPPORT IS CURRENTLY SETTING IT UP */
            <div className="space-y-4">
              {awaitingVpsList.map((awaitingVps) => (
                <Card
                  key={awaitingVps.id}
                  className="rounded-2xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card to-card shadow-sm overflow-hidden"
                >
                  <CardHeader className="p-5 pb-3 border-b border-amber-500/20 bg-amber-500/5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                          <Clock className="h-5 w-5 animate-spin" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base font-black tracking-tight text-foreground">
                              Server VPS Sedang Dikonfigurasi oleh Tim IT Support SaCMS
                            </CardTitle>
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              Menunggu Setup IT
                            </Badge>
                          </div>
                          <CardDescription className="text-xs text-muted-foreground mt-0.5">
                            Pesanan server &apos;{awaitingVps.serverName}&apos; ({awaitingVps.planName}) sedang dalam proses penyediaan &amp; pengamanan oleh tim teknis SaCMS.
                          </CardDescription>
                        </div>
                      </div>

                      <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 self-start sm:self-center">
                        <Ticket className="h-3.5 w-3.5 text-amber-500" />
                        Tiket: <span className="font-mono font-bold text-foreground">#{awaitingVps.ticketId?.slice(0, 8).toUpperCase() || "SUPPORT"}</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-3">
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3.5 space-y-2 text-xs">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-amber-500" /> Tahapan Konfigurasi Tim IT:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>1. Pembayaran Berhasil</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold">
                          <Clock className="h-3.5 w-3.5 shrink-0 animate-spin" />
                          <span>2. Alokasi Server &amp; IP</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Radio className="h-3.5 w-3.5 shrink-0" />
                          <span>3. Setup PostgreSQL 17</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          <span>4. Pengujian Enkripsi</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 border-t border-border/50 pt-2">
                        Estimasi pengerjaan: <strong>1–3 jam kerja</strong>. Setelah selesai, status akan otomatis berubah menjadi <strong>&quot;Siap Digunakan&quot;</strong> dan tombol integrasi akan muncul di sini.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* STATE D: NO VPS AT ALL - SHOW 3-STEP SOP FLOW WITH SUBSCRIPTIONS CTA */
            <Card className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-muted/20 shadow-xs overflow-hidden">
              <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                        Dedicated Server VPS / VDS SaCMS
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Tingkatkan performa, isolasi fisik, dan kapasitas tak terbatas dengan server mandiri yang disiapkan penuh oleh Tim IT SaCMS.
                      </CardDescription>
                    </div>
                  </div>

                  <Button
                    asChild
                    size="sm"
                    className="rounded-xl h-8 px-4 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs self-start sm:self-center cursor-pointer"
                  >
                    <Link href="/dashboard/services">
                      Kelola VPS di Dashboard Server
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">Alur Kerja Penggunaan Server VPS di SaCMS:</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-border/70 bg-background/80 space-y-1.5">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                        1
                      </div>
                      <p className="text-xs font-bold text-foreground">Dikelola oleh Owner</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Server VPS dipesan dan dikelola oleh Owner melalui Dashboard Server terpusat.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/70 bg-background/80 space-y-1.5">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center">
                        2
                      </div>
                      <p className="text-xs font-bold text-foreground">Dikonfigurasi Tim IT SaCMS</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Tim IT menyiapkan server, menginstal database PostgreSQL 17 terisolasi, dan mengatur firewall aman.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border/70 bg-background/80 space-y-1.5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center">
                        3
                      </div>
                      <p className="text-xs font-bold text-foreground">Integrasi ke Workspace</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Setelah status &apos;Siap Digunakan&apos;, cukup klik tombol &quot;Hubungkan&quot; di halaman ini tanpa repot konfigurasi manual.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 2. ACTIVE SHARED CLUSTER STATUS OVERVIEW CARD */}
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
                  {hasDedicated ? "Dedicated Server Beroperasi" : "Shared Pool Beroperasi Normal"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipe Database</span>
                  <p className="text-xs font-bold text-foreground">
                    {hasDedicated ? "PostgreSQL 17 Terisolasi" : "PostgreSQL 17 Bersama"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {hasDedicated ? "Dedicated Tenant Engine" : "Shared Multi-Tenant Engine"}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Object Storage</span>
                  <p className="text-xs font-bold text-foreground">
                    {storageEndpoint ? "S3 Milik Sendiri (BYOS)" : "Storage Bersama SaCMS"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Kuota dihitung per workspace</p>
                </div>
                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Isolasi Keamanan</span>
                  <p className="text-xs font-bold text-foreground">
                    {hasDedicated ? "Physical & Logical Isolation" : "Tenant Logical Scoping"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Enkripsi Data In-Transit &amp; At-Rest</p>
                </div>
                <div className="p-3.5 rounded-xl bg-background border border-border/80 space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Alokasi Resource</span>
                  <p className="text-xs font-bold text-foreground">
                    {hasDedicated ? "Dedicated Hardware" : "Shared Pool SaCMS"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {hasDedicated ? "Zero Noisy Neighbor" : "Aplikasi dan API SaCMS bersama"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. MANAGED INFRASTRUCTURE BYODB / BYOS CARD */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Layanan Terkelola: Database &amp; Storage Sendiri (BYODB/BYOS)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Opsi migrasi khusus bagi instansi yang memiliki server on-premise atau infrastruktur cloud terpisah. Tim IT SaCMS membantu setup dan pemeliharaan bulanan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <p className="text-xs text-foreground">
                <span className="font-bold">Rp2.500.000</span> biaya setup satu kali + <span className="font-bold">Rp1.000.000/bulan</span> (bulan pertama dibayar saat memesan).
              </p>
              {managedInfra ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <p className="text-muted-foreground">
                    Status:{" "}
                    <span className="font-bold text-foreground">
                      {({
                        awaiting_setup: "Menunggu setup tim IT SaCMS",
                        active: "Aktif",
                        expired: "Kedaluwarsa",
                        cancelled: "Dibatalkan",
                      } as Record<string, string>)[managedInfra.status] ?? managedInfra.status}
                    </span>
                    {" · "}dibayar sampai{" "}
                    {new Date(managedInfra.paidUntil).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  {managedInfra.status !== "cancelled" && (
                    <Button asChild size="sm" className="rounded-xl h-8 text-xs">
                      <Link href={`/dashboard/${tenantSlug}/subscriptions/checkout?plan=managed_byodb_monthly`}>
                        Perpanjang 1 Bulan
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-bold">
                  <Link href={`/dashboard/${tenantSlug}/subscriptions/checkout?plan=managed_byodb_setup`}>
                    Pesan Layanan Setup BYODB
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: CONSOLE IT SUPPORT (Super Admin only manual overrides)       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {isSuperAdmin && activeTab === "console" && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          {/* BYODB: Custom PostgreSQL Connection */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Koneksi Basis Data Sendiri (Bring Your Own Database / BYODB)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Hubungkan instance PostgreSQL eksternal milik instansi Anda untuk menyimpan seluruh konten dan skema secara terisolasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="databaseUrl" className="text-xs font-semibold text-foreground">
                  PostgreSQL Connection URL
                </Label>
                <Input
                  id="databaseUrl"
                  type="password"
                  placeholder="postgresql://user:password@db.perusahaan.com:5432/tenant_db?sslmode=require"
                  value={databaseUrl}
                  onChange={(e) => setDatabaseUrl(e.target.value)}
                  className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Kosongkan nilai ini dan simpan jika ingin kembali menggunakan cluster database bersama (Shared Pool) default dari SaCMS Cloud.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* BYOS: Custom S3 Storage */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Koneksi Storage S3 Sendiri (Bring Your Own Storage / BYOS)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Simpan seluruh unggahan media secara mandiri ke bucket AWS S3, Cloudflare R2, MinIO, atau Google Cloud Storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="storageEndpoint" className="text-xs font-semibold text-foreground">
                    S3 Endpoint URL
                  </Label>
                  <Input
                    id="storageEndpoint"
                    placeholder="https://s3.ap-southeast-1.amazonaws.com"
                    value={storageEndpoint}
                    onChange={(e) => setStorageEndpoint(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="storageBucket" className="text-xs font-semibold text-foreground">
                    Nama Bucket S3
                  </Label>
                  <Input
                    id="storageBucket"
                    placeholder="nama-bucket-media"
                    value={storageBucket}
                    onChange={(e) => setStorageBucket(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="storageAccessKey" className="text-xs font-semibold text-foreground">
                    Access Key ID
                  </Label>
                  <Input
                    id="storageAccessKey"
                    placeholder="AKIA..."
                    value={storageAccessKey}
                    onChange={(e) => setStorageAccessKey(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="storageSecretKey" className="text-xs font-semibold text-foreground">
                    Secret Access Key
                  </Label>
                  <Input
                    id="storageSecretKey"
                    type="password"
                    placeholder="••••••••••••"
                    value={storageSecretKey}
                    onChange={(e) => setStorageSecretKey(e.target.value)}
                    className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="storagePublicUrl" className="text-xs font-semibold text-foreground">
                  Public CDN Base URL
                </Label>
                <Input
                  id="storagePublicUrl"
                  placeholder="https://media.perusahaan.com"
                  value={storagePublicUrl}
                  onChange={(e) => setStoragePublicUrl(e.target.value)}
                  className="rounded-xl h-9 text-xs bg-background border-border/80 font-mono"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Disconnect VPS Confirmation Dialog */}
      <AlertDialog
        open={Boolean(selectedVpsToDisconnect)}
        onOpenChange={(open) => !open && setSelectedVpsToDisconnect(null)}
      >
        <AlertDialogContent className="rounded-2xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Putuskan Sambungan Server VPS?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Tindakan ini akan mengembalikan koneksi workspace ke <strong>Shared Multi-Tenant Pool</strong>. Server VPS Anda tetap aktif dan dapat dihubungkan kembali kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={actionLoading} className="rounded-xl text-xs font-bold">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading}
              onClick={handleDisconnectVps}
              className="rounded-xl text-xs font-bold bg-destructive hover:bg-destructive/90 text-white"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Ya, Putuskan Sambungan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
