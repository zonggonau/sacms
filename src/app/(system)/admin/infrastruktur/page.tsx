"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Globe,
  Power,
  RotateCw,
  PowerOff,
  ShieldCheck,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Receipt,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ContaboInstance {
  instanceId: number
  name: string
  displayName: string
  dataCenter: string
  region: string
  regionName: string
  productName?: string
  ramMb: number
  cpuCores: number
  diskMb: number
  osType: string
  createdDate: string
  status: string
  ipConfig: { v4: { ip: string } }
  availableUpgrades: { productId: string; name: string; additionalPrice?: { price: number; currency: string } }[]
}

interface AppHealth {
  status: string
  checks: Record<string, any>
}

type PendingAction = { instanceId: number; action: "start" | "restart" | "shutdown" } | null

const ACTION_LABEL: Record<string, string> = {
  start: "Nyalakan",
  restart: "Restart",
  shutdown: "Shutdown (Graceful)",
}

const ACTION_WARNING: Record<string, string> = {
  start: "Server akan dinyalakan. Tidak ada downtime tambahan jika server memang sedang mati.",
  restart: "Server produksi akan di-restart sekarang. Semua koneksi aktif (termasuk request yang sedang berjalan) akan terputus selama proses reboot (biasanya 30-90 detik).",
  shutdown: "Server produksi akan dimatikan secara graceful (ACPI shutdown). SaCMS Cloud akan DOWN total sampai Anda menyalakannya kembali secara manual dari halaman ini atau panel Contabo.",
}

export default function InfrastrukturPage() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [instances, setInstances] = useState<ContaboInstance[]>([])
  const [appHealth, setAppHealth] = useState<AppHealth | null>(null)
  const [configured, setConfigured] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [runningAction, setRunningAction] = useState(false)
  const [enablingBackupFor, setEnablingBackupFor] = useState<number | null>(null)

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch("/api/admin/infrastructure/vps")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal memuat data infrastruktur")
      setConfigured(data.configured !== false)
      setConfigError(data.error || null)
      setInstances(data.instances || [])
      setAppHealth(data.appHealth || null)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Memuat", description: err.message || "Terjadi kesalahan" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRunAction = async () => {
    if (!pendingAction) return
    setRunningAction(true)
    try {
      const res = await fetch(`/api/admin/infrastructure/vps/${pendingAction.instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: pendingAction.action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Aksi gagal dijalankan")
      toast({ title: "Perintah Terkirim", description: `${ACTION_LABEL[pendingAction.action]} sedang diproses oleh Contabo.` })
      setPendingAction(null)
      setTimeout(() => fetchData(true), 3000)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message || "Terjadi kesalahan" })
    } finally {
      setRunningAction(false)
    }
  }

  const handleEnableBackup = async (instanceId: number) => {
    setEnablingBackupFor(instanceId)
    try {
      const res = await fetch(`/api/admin/infrastructure/vps/${instanceId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable-backup" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal mengaktifkan add-on")
      toast({ title: "Add-on Backup Diaktifkan", description: "Automated Backup sedang diaktifkan oleh Contabo untuk instance ini." })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal", description: err.message || "Terjadi kesalahan" })
    } finally {
      setEnablingBackupFor(null)
    }
  }

  if (!session?.user || session.user.role !== "super_admin") {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[60vh] flex items-center justify-center p-6">
          <Card className="max-w-md w-full rounded-2xl border-border/80 shadow-xs">
            <CardHeader className="text-center p-6">
              <ShieldCheck className="w-10 h-10 mx-auto text-primary mb-2" />
              <CardTitle className="text-base font-bold">Akses Dibatasi</CardTitle>
              <CardDescription className="text-xs">
                Hanya administrator yang dapat mengakses infrastruktur server.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                  <Server className="w-6 h-6 text-primary" />
                  Infrastruktur VPS
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  Contabo
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Server produksi yang menjalankan SaCMS Cloud — monitoring, kontrol daya, dan add-on.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="rounded-xl text-xs font-bold h-9"
            >
              {refreshing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Refresh
            </Button>
          </div>

          {/* App Health */}
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" /> Status Aplikasi SaCMS Cloud
              </CardTitle>
              <CardDescription className="text-xs">
                Dari endpoint internal <code className="bg-muted/40 px-1 py-0.5 rounded text-[10px] font-mono">/api/health</code> — database, Redis, dan memory proses aplikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              {loading ? (
                <Skeleton className="h-16 w-full rounded-xl" />
              ) : appHealth ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Status</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {appHealth.status === "healthy" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      )}
                      <span className="text-xs font-bold text-foreground capitalize">{appHealth.status}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Database</p>
                    <p className="text-xs font-bold text-foreground mt-1">{appHealth.checks?.database?.status || "-"}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Redis</p>
                    <p className="text-xs font-bold text-foreground mt-1">{appHealth.checks?.redis?.status || "-"}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Uptime Proses</p>
                    <p className="text-xs font-bold text-foreground mt-1">{appHealth.checks?.uptime || "-"}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" /> Tidak bisa menjangkau /api/health.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Config error */}
          {!configured && (
            <Card className="border border-amber-500/30 bg-amber-500/5 rounded-2xl shadow-xs">
              <CardContent className="p-5 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Contabo API belum terkonfigurasi</p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1">
                    {configError || "Set CONTABO_CLIENT_ID, CONTABO_CLIENT_SECRET, CONTABO_API_USER, dan CONTABO_API_PASSWORD di environment server."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* VPS Instances */}
          {loading ? (
            <div className="grid grid-cols-1 gap-4">
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : instances.length === 0 && configured ? (
            <Card className="border border-border/80 shadow-xs bg-card rounded-2xl">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Server className="w-8 h-8 mx-auto opacity-20 mb-2" />
                <p className="text-xs font-bold text-foreground">Tidak ada instance Contabo ditemukan</p>
              </CardContent>
            </Card>
          ) : (
            instances.map((instance) => {
              const isRunning = instance.status === "running"
              return (
                <Card key={instance.instanceId} className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">
                          {instance.displayName || instance.name}
                        </CardTitle>
                        <Badge
                          className={cn(
                            "text-[9px] font-bold uppercase rounded-full border shadow-none",
                            isRunning
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}
                        >
                          <div className={cn("w-1.5 h-1.5 rounded-full mr-1", isRunning ? "bg-emerald-500 animate-pulse" : "bg-rose-500")} />
                          {instance.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        {instance.name} &bull; #{instance.instanceId} &bull; {instance.regionName || instance.region}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRunning}
                        onClick={() => setPendingAction({ instanceId: instance.instanceId, action: "start" })}
                        className="h-8 rounded-lg text-[11px] font-bold"
                      >
                        <Power className="h-3 w-3 mr-1" /> Start
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPendingAction({ instanceId: instance.instanceId, action: "restart" })}
                        className="h-8 rounded-lg text-[11px] font-bold"
                      >
                        <RotateCw className="h-3 w-3 mr-1" /> Restart
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isRunning}
                        onClick={() => setPendingAction({ instanceId: instance.instanceId, action: "shutdown" })}
                        className="h-8 rounded-lg text-[11px] font-bold text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        <PowerOff className="h-3 w-3 mr-1" /> Shutdown
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</p>
                        <p className="text-sm font-bold text-foreground mt-1">{instance.cpuCores} cores</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><MemoryStick className="h-3 w-3" /> RAM</p>
                        <p className="text-sm font-bold text-foreground mt-1">{Math.round(instance.ramMb / 1024)} GB</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><HardDrive className="h-3 w-3" /> Disk</p>
                        <p className="text-sm font-bold text-foreground mt-1">{Math.round(instance.diskMb / 1024)} GB</p>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-1"><Globe className="h-3 w-3" /> IP Publik</p>
                        <p className="text-sm font-bold text-foreground font-mono mt-1">{instance.ipConfig?.v4?.ip || "-"}</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-muted/20 border border-border/60">
                      <div>
                        <p className="text-xs font-bold text-foreground">{instance.productName || "Plan tidak diketahui"}</p>
                        <p className="text-[11px] text-muted-foreground">Dibuat {new Date(instance.createdDate).toLocaleDateString("id-ID")}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={enablingBackupFor === instance.instanceId}
                        onClick={() => handleEnableBackup(instance.instanceId)}
                        className="h-8 rounded-lg text-[11px] font-bold shrink-0"
                      >
                        {enablingBackupFor === instance.instanceId ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <HardDrive className="h-3 w-3 mr-1" />}
                        Aktifkan Add-on Automated Backup
                      </Button>
                    </div>

                    {instance.availableUpgrades?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Opsi Upgrade Tersedia</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {instance.availableUpgrades.slice(0, 6).map((upg) => (
                            <div key={upg.productId} className="p-3 rounded-xl border border-border/60 bg-card text-xs">
                              <p className="font-bold text-foreground">{upg.name}</p>
                              {upg.additionalPrice && (
                                <p className="text-muted-foreground mt-0.5">
                                  +{upg.additionalPrice.price} {upg.additionalPrice.currency}/bln
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Untuk upgrade resource (CPU/RAM/Disk) secara aman, lakukan dari{" "}
                          <a href="https://my.contabo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold inline-flex items-center gap-0.5">
                            Panel Contabo <ExternalLink className="h-3 w-3" />
                          </a>{" "}
                          — API publik Contabo belum mendokumentasikan endpoint upgrade resource secara jelas.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}

          {/* Billing */}
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Pembayaran &amp; Invoice
              </CardTitle>
              <CardDescription className="text-xs">
                Contabo tidak menyediakan API publik untuk invoice/tagihan — riwayat pembayaran dan faktur hanya bisa dilihat di panel pelanggan Contabo.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <a href="https://my.contabo.com/account/billing" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="rounded-xl text-xs font-bold h-9">
                  Buka Billing Contabo <ArrowUpRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </a>
            </CardContent>
          </Card>

          {/* Action confirmation */}
          <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
            <AlertDialogContent className="rounded-2xl border-border/80 shadow-xl bg-card max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {pendingAction ? `${ACTION_LABEL[pendingAction.action]} Server Produksi?` : ""}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  {pendingAction ? ACTION_WARNING[pendingAction.action] : ""}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
                <AlertDialogCancel disabled={runningAction} className="rounded-xl text-xs font-bold h-9">Batal</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={handleRunAction}
                  disabled={runningAction}
                  className="rounded-xl text-xs font-bold h-9"
                >
                  {runningAction ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  {pendingAction ? `Ya, ${ACTION_LABEL[pendingAction.action]}` : ""}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
