"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Server,
  HardDrive,
  Cpu,
  Zap,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
  ExternalLink,
  Layers,
  Database,
  RefreshCw,
  Loader2,
  AlertCircle,
  Headphones,
  Settings2,
  Check,
  Globe,
  Cloud,
  Copy,
  Share2,
  Unlink,
  CheckCircle,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatRupiah } from "@/lib/plan-pricing"
import {
  orderVpsAction,
  setupVpsAction,
  fetchContaboInstancesAction,
  assignVpsToWorkspaceAction,
  disconnectVpsFromWorkspaceAction,
  assignContaboToWorkspaceAction,
} from "@/actions/vps-service"
import type { ContaboInstance } from "@/lib/contabo"
import { useRouter } from "next/navigation"
import Link from "next/link"

export interface VpsPlanItem {
  id: string
  plan_slug: string
  name: string
  desc?: string
  description?: string
  price: number
  yearly_price?: number
  features?: string[]
  max_storage?: number
  max_content_entries?: number
  is_popular?: boolean
  category?: "vps" | "vds" | "storage"
}

export interface UserVpsItem {
  id: string
  planSlug: string
  planName: string
  serverName: string
  billingCycle: string
  pricePaid: number
  status: string // awaiting_setup | ready | in_use | cancelled
  serverIp?: string | null
  databaseUrl?: string | null
  specs?: any
  notes?: string | null
  ticketId?: string | null
  tenantId?: string | null
  paidUntil: string | Date
  createdAt: string | Date
  tenant?: {
    id: string
    name: string
    slug: string
  } | null
}

export interface WorkspaceItem {
  id: string
  name: string
  slug: string
  databaseUrl?: string | null
  createdAt?: string | Date
  ownerId?: string | null
}

interface ServicesViewProps {
  workspaces?: WorkspaceItem[]
  userVpsList: UserVpsItem[]
  catalogPlans: VpsPlanItem[]
  contaboInstances?: ContaboInstance[]
  contaboError?: string
  isSuperAdmin?: boolean
  userName?: string
  userEmail?: string
}

export function ServicesView({
  workspaces = [],
  userVpsList: initialUserVps,
  catalogPlans,
  contaboInstances: initialContabo = [],
  contaboError: initialContaboError,
  isSuperAdmin = false,
  userName,
  userEmail,
}: ServicesViewProps) {
  const router = useRouter()
  const [userVps, setUserVps] = useState<UserVpsItem[]>(initialUserVps)
  const [contaboList, setContaboList] = useState<ContaboInstance[]>(initialContabo)
  const [contaboError, setContaboError] = useState<string | undefined>(initialContaboError)
  const [isSyncingContabo, setIsSyncingContabo] = useState(false)
  const [copiedIp, setCopiedIp] = useState<string | null>(null)
  const [copiedWorkspaceId, setCopiedWorkspaceId] = useState<string | null>(null)
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [filterCategory, setFilterCategory] = useState<"all" | "vps" | "vds">("all")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")

  // Modal Alokasi Contabo ke Workspace (Super Admin)
  const [assigningContabo, setAssigningContabo] = useState<ContaboInstance | null>(null)
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string>("")
  const [isAssigning, setIsAssigning] = useState(false)

  // Modal Hubungkan VPS Standalone ke Workspace (User/Admin)
  const [assigningVps, setAssigningVps] = useState<UserVpsItem | null>(null)

  // Modal Pemesanan VPS
  const [selectedPlanToOrder, setSelectedPlanToOrder] = useState<VpsPlanItem | null>(null)
  const [orderForm, setOrderForm] = useState({
    serverName: "",
    notes: "",
  })
  const [isOrdering, setIsOrdering] = useState(false)

  // Modal Setup IT Support
  const [vpsToSetup, setVpsToSetup] = useState<UserVpsItem | null>(null)
  const [setupForm, setSetupForm] = useState({
    serverIp: "",
    databaseUrl: "",
    adminNotes: "",
  })
  const [isSettingUp, setIsSettingUp] = useState(false)

  // State Disconnect VPS
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null)

  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip)
    setCopiedIp(ip)
    setTimeout(() => setCopiedIp(null), 2000)
    toast({ title: "IP Tersalin", description: `${ip} telah disalin ke clipboard.` })
  }

  const handleCopyWorkspaceId = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedWorkspaceId(id)
    setTimeout(() => setCopiedWorkspaceId(null), 2000)
    toast({ title: "Workspace ID Tersalin", description: `${id} telah disalin ke clipboard.` })
  }

  // Refresh Contabo Instances (Super Admin only)
  const handleRefreshContabo = async () => {
    setIsSyncingContabo(true)
    try {
      const res = await fetchContaboInstancesAction()
      if (res.success && res.instances) {
        setContaboList(res.instances)
        setContaboError(undefined)
        toast({
          title: "Data Contabo Diperbarui",
          description: `Berhasil memuat ${res.instances.length} instance langsung dari Contabo API.`,
        })
      } else {
        setContaboError(res.error)
        toast({
          variant: "destructive",
          title: "Gagal Sinkronisasi",
          description: res.error || "Gagal mengambil instance Contabo.",
        })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsSyncingContabo(false)
    }
  }

  // Super Admin: Alokasikan Contabo ke Workspace Pelanggan
  const handleConfirmAssignContabo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningContabo || !targetWorkspaceId) {
      toast({ variant: "destructive", title: "Pilih Workspace", description: "Silakan pilih Workspace tujuan." })
      return
    }

    setIsAssigning(true)
    try {
      const res = await assignContaboToWorkspaceAction({
        instanceId: assigningContabo.instanceId,
        serverName: assigningContabo.displayName || assigningContabo.name,
        serverIp: assigningContabo.ipConfig.v4.ip,
        tenantId: targetWorkspaceId,
        productId: assigningContabo.productId,
        productName: assigningContabo.productName,
        cpuCores: assigningContabo.cpuCores,
        ramMb: assigningContabo.ramMb,
        diskMb: assigningContabo.diskMb,
      })

      if (res.success) {
        toast({
          title: "🎉 Server Contabo Berhasil Dialokasikan!",
          description: res.message,
        })
        setAssigningContabo(null)
        setTargetWorkspaceId("")
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Alokasi", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsAssigning(false)
    }
  }

  // Hubungkan VPS Standalone ke Workspace
  const handleConfirmAssignVps = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!assigningVps || !targetWorkspaceId) {
      toast({ variant: "destructive", title: "Pilih Workspace", description: "Silakan pilih Workspace tujuan." })
      return
    }

    setIsAssigning(true)
    try {
      const res = await assignVpsToWorkspaceAction({
        serviceId: assigningVps.id,
        tenantId: targetWorkspaceId,
      })

      if (res.success) {
        toast({
          title: "🎉 VPS Berhasil Terhubung ke Workspace!",
          description: res.message,
        })
        setAssigningVps(null)
        setTargetWorkspaceId("")
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Menghubungkan", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setIsAssigning(false)
    }
  }

  // Putus Hubungan VPS dari Workspace
  const handleDisconnectVps = async (serviceId: string) => {
    if (!confirm("Apakah Anda yakin ingin melepas server VPS ini dari workspace? Database workspace akan kembali ke mode Shared Multi-Tenant.")) {
      return
    }

    setDisconnectingId(serviceId)
    try {
      const res = await disconnectVpsFromWorkspaceAction({ serviceId })
      if (res.success) {
        toast({
          title: "Koneksi VPS Dilepas",
          description: res.message,
        })
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Melepas Koneksi", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setDisconnectingId(null)
    }
  }

  // Filter Catalog
  const filteredPlans = catalogPlans.filter((p) => {
    const slug = (p.plan_slug || p.id || "").toLowerCase()
    const name = (p.name || "").toLowerCase()
    const isVds = slug.includes("vds") || name.includes("vds")
    if (filterCategory === "vds") return isVds
    if (filterCategory === "vps") return !isVds
    return true
  })

  // Open Order Dialog
  const handleOpenOrder = (plan: VpsPlanItem) => {
    setSelectedPlanToOrder(plan)
    setOrderForm({
      serverName: `Server ${plan.name.replace(/SaCMS |Cloud /gi, "")} #${Math.floor(100 + Math.random() * 900)}`,
      notes: "",
    })
  }

  // Handle Order Submit
  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanToOrder) return
    if (!orderForm.serverName.trim()) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "Nama server wajib diisi." })
      return
    }

    setIsOrdering(true)
    try {
      const price =
        billingCycle === "yearly" && selectedPlanToOrder.yearly_price
          ? selectedPlanToOrder.yearly_price
          : selectedPlanToOrder.price

      const res = await orderVpsAction({
        planSlug: selectedPlanToOrder.plan_slug || selectedPlanToOrder.id,
        planName: selectedPlanToOrder.name,
        serverName: orderForm.serverName.trim(),
        billingCycle,
        pricePaid: price,
        specs: {
          features: selectedPlanToOrder.features || [],
          maxStorage: selectedPlanToOrder.max_storage,
        },
        notes: orderForm.notes.trim() || undefined,
      })

      if (res.success) {
        toast({
          title: "🎉 Pesanan VPS Berhasil!",
          description: "Pesanan telah dikonfirmasi. Tim IT Support segera melakukan setup server Anda.",
        })
        setSelectedPlanToOrder(null)
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Pemesanan Gagal", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Kesalahan", description: err.message || "Gagal memproses pesanan." })
    } finally {
      setIsOrdering(false)
    }
  }

  // Open Setup IT Support Dialog
  const handleOpenSetup = (vps: UserVpsItem) => {
    setVpsToSetup(vps)
    const randomIpSuffix = Math.floor(20 + Math.random() * 200)
    setSetupForm({
      serverIp: vps.serverIp || `161.97.100.${randomIpSuffix}`,
      databaseUrl:
        vps.databaseUrl ||
        `postgresql://vps_user_${vps.id.slice(-6)}:secPass${Math.floor(1000 + Math.random() * 9000)}@161.97.100.${randomIpSuffix}:5432/vps_db_${vps.id.slice(-6)}?schema=public`,
      adminNotes: "Instalasi PostgreSQL 17 berhasil. Port 5432 dibuka & firewall internal terkonfigurasi.",
    })
  }

  // Submit Setup IT Support
  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vpsToSetup) return
    if (!setupForm.serverIp.trim() || !setupForm.databaseUrl.trim()) {
      toast({ variant: "destructive", title: "Validasi Gagal", description: "IP Server dan Database URL wajib diisi." })
      return
    }

    setIsSettingUp(true)
    try {
      const res = await setupVpsAction({
        serviceId: vpsToSetup.id,
        serverIp: setupForm.serverIp.trim(),
        databaseUrl: setupForm.databaseUrl.trim(),
        adminNotes: setupForm.adminNotes.trim() || undefined,
      })

      if (res.success) {
        toast({
          title: "✅ Setup IT Support Berhasil!",
          description: "Status VPS kini 'Siap Digunakan' dan dapat dihubungkan ke workspace.",
        })
        setVpsToSetup(null)
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Setup", description: res.error })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Kesalahan", description: err.message || "Gagal mengonfigurasi server." })
    } finally {
      setIsSettingUp(false)
    }
  }

  // Statistics calculation
  const readyCount = userVps.filter((v) => v.status === "ready").length
  const awaitingCount = userVps.filter((v) => v.status === "awaiting_setup").length
  const inUseCount = userVps.filter((v) => v.status === "in_use").length

  const hasUserInstances = userVps.length > 0

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header Hero Section */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-muted/50 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="outline" className="text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border-primary/30 bg-primary/10 text-primary">
              <Server className="h-3.5 w-3.5 mr-1.5 inline" />
              Layanan Infrastruktur Dedicated
            </Badge>
            <Badge variant="secondary" className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              PostgreSQL 17 Native
            </Badge>
            {isSuperAdmin && (
              <Badge variant="secondary" className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <ShieldCheck className="h-3.5 w-3.5 mr-1 inline" /> Mode Super Admin
              </Badge>
            )}
          </div>

          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-foreground">
            Layanan Cloud VPS &amp; Dedicated Server
          </h1>

          <p className="text-xs md:text-sm text-muted-foreground leading-relaxed">
            {isSuperAdmin
              ? "Kelola master compute instance Contabo Cloud dan pantau alokasi server VPS aktif pada Workspace ID masing-masing pelanggan."
              : hasUserInstances
              ? "Daftar server VPS mandiri aktif milik Anda dengan PostgreSQL 17 terisolasi."
              : "Infrastruktur server mandiri berperforma tinggi dengan database PostgreSQL 17 terisolasi penuh. Pilih spesifikasi server di bawah untuk mendapatkan server dedicated bagi workspace Anda."}
          </p>

          {/* Quick Metrics Bar: HANYA jika Super Admin ATAU user memiliki server instance */}
          {isSuperAdmin ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Layanan SaCMS</p>
                <p className="text-lg font-black text-foreground">{userVps.length} Server</p>
              </div>
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Contabo Cloud Master</p>
                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                </div>
                <p className="text-lg font-black text-foreground">{contaboList.length} Instance</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Siap Pakai</p>
                <p className="text-lg font-black text-foreground">{readyCount} Server</p>
              </div>
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Terhubung Workspace</p>
                <p className="text-lg font-black text-foreground">{inUseCount} Server</p>
              </div>
            </div>
          ) : hasUserInstances ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
              <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Server VPS Anda</p>
                <p className="text-lg font-black text-foreground">{userVps.length} Server</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Dedicated Aktif</p>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <p className="text-lg font-black text-foreground">{inUseCount} Server</p>
              </div>
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/5 p-3 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Siap Dihubungkan</p>
                <p className="text-lg font-black text-foreground">{readyCount} Server</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* VIEW MODE TOOLBAR: TOGGLE CARD VS TABEL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-card/90 rounded-2xl border border-border/80 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">Mode Tampilan:</span>
          <span className="text-xs text-muted-foreground">
            {viewMode === "grid" ? "Tampilan Kartu (Card Grid)" : "Tampilan Tabel Ringkas"}
          </span>
        </div>

        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70 text-xs shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
              viewMode === "grid"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Card
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer",
              viewMode === "table"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <TableIcon className="h-3.5 w-3.5" />
            Tabel
          </button>
        </div>
      </div>

      {/* SECTION KHUSUS SUPER ADMIN: MASTER CONTABO COMPUTE INSTANCES */}
      {isSuperAdmin && (
        <div className="space-y-4 rounded-3xl border border-sky-500/30 bg-gradient-to-b from-sky-500/10 via-card to-card p-5 md:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                <Cloud className="h-5 w-5 text-sky-500" />
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  Master Infrastructure Contabo Cloud (Khusus Super Admin)
                </h2>
                <Badge variant="outline" className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  GET /v1/compute/instances
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Infrastruktur compute master milik Super Admin. Anda dapat menghubungkan atau mengalokasikan instance ini langsung ke Workspace ID pelanggan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSyncingContabo}
                onClick={handleRefreshContabo}
                className="h-8.5 text-xs font-bold rounded-xl border-sky-500/30 text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncingContabo && "animate-spin")} />
                {isSyncingContabo ? "Menyinkronkan..." : "Sinkronkan Contabo"}
              </Button>
            </div>
          </div>

          {contaboError && (
            <div className="p-3.5 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Koneksi Contabo API mengalami kendala: {contaboError}</span>
            </div>
          )}

          {contaboList.length === 0 && !contaboError ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
              Tidak ada compute instance yang ditemukan pada akun master Contabo Anda.
            </div>
          ) : viewMode === "table" ? (
            /* TABEL VIEW CONTABO */
            <div className="rounded-2xl border border-sky-500/30 bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-sky-500/5">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Instance / Server</TableHead>
                    <TableHead className="text-xs font-bold">Public IPv4</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                    <TableHead className="text-xs font-bold">Spesifikasi</TableHead>
                    <TableHead className="text-xs font-bold">Datacenter</TableHead>
                    <TableHead className="text-xs font-bold">Status Terhubung</TableHead>
                    <TableHead className="text-xs font-bold text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contaboList.map((inst) => {
                    const ipv4 = inst.ipConfig?.v4?.ip || "Belum ada IP"
                    const isRunning = inst.status?.toLowerCase() === "running"
                    const existingMapped = userVps.find((v) => v.serverIp === ipv4)

                    return (
                      <TableRow key={inst.instanceId} className="hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground text-xs">{inst.displayName || inst.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {inst.name}
                              </span>
                            </div>
                            <p className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">
                              {inst.productName || `ID: ${inst.productId}`}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                            <span>{ipv4}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyIp(ipv4)}
                              className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              title="Salin IP"
                            >
                              {copiedIp === ipv4 ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {isRunning ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Running
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                              {inst.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-foreground font-medium">
                          <div className="space-y-0.5 text-[11px]">
                            <span>{inst.cpuCores} vCPU</span> · <span>{Math.round(inst.ramMb / 1024)} GB RAM</span> · <span>{Math.round(inst.diskMb / 1024)} GB SSD</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{inst.dataCenter}</span> ({inst.region || "EU"})
                        </TableCell>
                        <TableCell className="py-3">
                          {existingMapped?.tenant ? (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                              Terhubung: {existingMapped.tenant.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Belum dialokasikan</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          {existingMapped?.tenant ? (
                            <Button asChild size="sm" variant="ghost" className="h-7.5 text-xs font-bold text-primary">
                              <Link href={`/dashboard/${existingMapped.tenant.slug || existingMapped.tenant.id}`}>
                                Buka <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setAssigningContabo(inst)
                                setTargetWorkspaceId(workspaces[0]?.id || "")
                              }}
                              className="h-7.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white gap-1"
                            >
                              <Share2 className="h-3 w-3" />
                              Alokasikan
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* CARD VIEW CONTABO */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              {contaboList.map((inst) => {
                const ipv4 = inst.ipConfig?.v4?.ip || "Belum ada IP"
                const isRunning = inst.status?.toLowerCase() === "running"
                const existingMapped = userVps.find((v) => v.serverIp === ipv4)

                return (
                  <Card
                    key={inst.instanceId}
                    className="rounded-2xl border border-sky-500/30 bg-card/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between"
                  >
                    <CardHeader className="p-4 sm:p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-foreground">{inst.displayName || inst.name}</span>
                            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                              {inst.name}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                            {inst.productName || `Product ID: ${inst.productId}`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isRunning ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Running
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize">
                              {inst.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                      {/* Specs Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">
                            <Cpu className="h-3 w-3 text-primary" /> CPU
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5">{inst.cpuCores} vCPU Cores</p>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">
                            <Zap className="h-3 w-3 text-amber-500" /> RAM
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {Math.round(inst.ramMb / 1024)} GB RAM
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">
                            <HardDrive className="h-3 w-3 text-sky-500" /> Storage
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5">
                            {Math.round(inst.diskMb / 1024)} GB SSD
                          </p>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
                          <div className="flex items-center gap-1 text-muted-foreground text-[10px] font-bold uppercase">
                            <Globe className="h-3 w-3 text-emerald-500" /> Lokasi
                          </div>
                          <p className="text-xs font-bold text-foreground mt-0.5 truncate" title={inst.dataCenter}>
                            {inst.region || "EU"}
                          </p>
                        </div>
                      </div>

                      {/* Network Details */}
                      <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Public IPv4:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">{ipv4}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyIp(ipv4)}
                              className="p-1 hover:bg-background rounded text-muted-foreground hover:text-foreground transition-colors"
                              title="Salin Alamat IP"
                            >
                              {copiedIp === ipv4 ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Datacenter:</span>
                          <span className="font-medium text-foreground">{inst.dataCenter}</span>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Instance ID:</span>
                          <span className="font-mono font-medium text-foreground">#{inst.instanceId}</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-2">
                        {existingMapped?.tenant ? (
                          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-blue-500/20 bg-blue-500/10 text-xs">
                            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold truncate">
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">Terhubung ke: {existingMapped.tenant.name}</span>
                            </div>
                            <Button asChild size="sm" variant="ghost" className="h-7 text-xs font-bold text-primary">
                              <Link href={`/dashboard/${existingMapped.tenant.slug || existingMapped.tenant.id}`}>
                                Buka <ArrowRight className="h-3 w-3 ml-1" />
                              </Link>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setAssigningContabo(inst)
                              setTargetWorkspaceId(workspaces[0]?.id || "")
                            }}
                            className="w-full h-8.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white shadow-xs gap-1.5 cursor-pointer"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Alokasikan ke Workspace Pelanggan
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: SERVER VPS AKTIF MILIK USER (HANYA DITAMPILKAN JIKA USER MEMILIKI INSTANCE) */}
      {hasUserInstances && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  Server VPS Saya
                </h2>
                <Badge variant="secondary" className="text-xs font-bold rounded-full px-2.5 py-0.5">
                  {userVps.length} Server
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daftar server VPS yang aktif dan terdaftar pada akun Anda.
              </p>
            </div>
          </div>

          {viewMode === "table" ? (
            /* TABEL VIEW USER VPS */
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Nama Server</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                    <TableHead className="text-xs font-bold">IP Publik</TableHead>
                    <TableHead className="text-xs font-bold">Database Engine</TableHead>
                    <TableHead className="text-xs font-bold">Workspace Terhubung</TableHead>
                    <TableHead className="text-xs font-bold">Siklus Tagihan</TableHead>
                    <TableHead className="text-xs font-bold text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userVps.map((vps) => {
                    const isAwaiting = vps.status === "awaiting_setup"
                    const isReady = vps.status === "ready"
                    const isInUse = vps.status === "in_use"

                    return (
                      <TableRow key={vps.id} className="hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <span className="font-bold text-foreground text-xs">{vps.serverName}</span>
                            <p className="text-[11px] text-muted-foreground">{vps.planName}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {isAwaiting && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                              <Clock className="h-3 w-3 animate-spin" />
                              Menunggu Setup
                            </Badge>
                          )}
                          {isReady && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Siap Digunakan
                            </Badge>
                          )}
                          {isInUse && (
                            <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Aktif Digunakan
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-foreground">
                            <span>{vps.serverIp || "Dialokasikan"}</span>
                            {vps.serverIp && (
                              <button
                                type="button"
                                onClick={() => handleCopyIp(vps.serverIp!)}
                                className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                                title="Salin IP"
                              >
                                {copiedIp === vps.serverIp ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <Database className="h-3.5 w-3.5" /> PostgreSQL 17
                          </span>
                        </TableCell>
                        <TableCell className="py-3">
                          {vps.tenant ? (
                            <div className="space-y-0.5 text-xs">
                              <span className="font-bold text-primary">{vps.tenant.name}</span>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                                <span>{vps.tenant.id.slice(0, 10)}...</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyWorkspaceId(vps.tenant!.id)}
                                  className="hover:text-foreground"
                                  title="Salin ID"
                                >
                                  {copiedWorkspaceId === vps.tenant.id ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Belum terhubung</span>
                          )}
                        </TableCell>
                        <TableCell className="py-3 text-xs text-foreground font-semibold capitalize">
                          {vps.billingCycle === "yearly" ? "Tahunan" : "Bulanan"}
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isInUse && vps.tenant && (
                              <>
                                <Button asChild size="sm" variant="default" className="h-7.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground">
                                  <Link href={`/dashboard/${vps.tenant.slug || vps.tenant.id}/cms`}>
                                    Studio
                                  </Link>
                                </Button>
                                <Button asChild size="sm" variant="outline" className="h-7.5 text-xs font-bold rounded-lg border-border">
                                  <Link href={`/dashboard/${vps.tenant.slug || vps.tenant.id}`}>
                                    Workspace
                                  </Link>
                                </Button>
                              </>
                            )}
                            {isReady && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  setAssigningVps(vps)
                                  setTargetWorkspaceId(workspaces[0]?.id || "")
                                }}
                                className="h-7.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                              >
                                <Share2 className="h-3 w-3" />
                                Hubungkan
                              </Button>
                            )}
                            {(isSuperAdmin || isAwaiting) && isAwaiting && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenSetup(vps)}
                                className="h-7.5 text-xs font-bold rounded-lg border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                              >
                                <Settings2 className="h-3 w-3 mr-1" /> Setup
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* CARD VIEW USER VPS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userVps.map((vps) => {
                const isAwaiting = vps.status === "awaiting_setup"
                const isReady = vps.status === "ready"
                const isInUse = vps.status === "in_use"

                return (
                  <Card
                    key={vps.id}
                    className={cn(
                      "rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between",
                      isInUse && "border-blue-500/40 bg-card shadow-xs",
                      isReady && "border-emerald-500/40 bg-card shadow-xs",
                      isAwaiting && "border-amber-500/40 bg-card shadow-xs"
                    )}
                  >
                    <CardHeader className="p-4 sm:p-5 pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-xs font-black uppercase text-foreground truncate">{vps.serverName}</span>
                          <p className="text-[11px] text-muted-foreground font-medium">{vps.planName}</p>
                        </div>

                        {/* Status Badges */}
                        {isAwaiting && (
                          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-spin" />
                            Menunggu Setup IT
                          </Badge>
                        )}
                        {isReady && (
                          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Siap Digunakan
                          </Badge>
                        )}
                        {isInUse && (
                          <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Aktif Digunakan
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                      <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>IP Server:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-foreground">
                              {vps.serverIp || "Belum dialokasikan"}
                            </span>
                            {vps.serverIp && (
                              <button
                                type="button"
                                onClick={() => handleCopyIp(vps.serverIp!)}
                                className="p-0.5 hover:bg-background rounded text-muted-foreground hover:text-foreground"
                                title="Salin IP"
                              >
                                {copiedIp === vps.serverIp ? (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground">
                          <span>Database:</span>
                          <span className="font-medium text-foreground">
                            {vps.databaseUrl ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Database className="h-3 w-3" /> PostgreSQL 17 Siap
                              </span>
                            ) : (
                              "Menunggu konfigurasi"
                            )}
                          </span>
                        </div>

                        {/* Info Workspace jika sudah terhubung */}
                        {vps.tenant && (
                          <div className="pt-2 border-t border-border/40 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Workspace:</span>
                              <span className="font-bold text-primary truncate max-w-[150px]">
                                {vps.tenant.name}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Workspace ID:</span>
                              <div className="flex items-center gap-1">
                                <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                                  {vps.tenant.id}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => handleCopyWorkspaceId(vps.tenant!.id)}
                                  className="p-0.5 hover:bg-background rounded text-muted-foreground"
                                  title="Salin ID Workspace"
                                >
                                  {copiedWorkspaceId === vps.tenant.id ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Explanatory text */}
                      {isAwaiting && (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 leading-snug">
                          <div className="flex items-start gap-2">
                            <Headphones className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                            <div>
                              <strong>Sedang disiapkan IT Support:</strong> Server Anda sedang dialokasikan. Anda akan menerima notifikasi begitu selesai.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-1 flex flex-col gap-2">
                        {isInUse && vps.tenant && (
                          <div className="flex items-center gap-2">
                            <Button asChild size="sm" className="flex-1 h-8.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground">
                              <Link href={`/dashboard/${vps.tenant.slug || vps.tenant.id}/cms`}>
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Buka CMS Studio
                              </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="h-8.5 text-xs font-bold rounded-xl border-border/80">
                              <Link href={`/dashboard/${vps.tenant.slug || vps.tenant.id}`}>
                                Buka Workspace
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={disconnectingId === vps.id}
                              onClick={() => handleDisconnectVps(vps.id)}
                              className="h-8.5 text-xs font-bold rounded-xl text-destructive hover:bg-destructive/10"
                              title="Lepas server dari workspace"
                            >
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {isReady && (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setAssigningVps(vps)
                                setTargetWorkspaceId(workspaces[0]?.id || "")
                              }}
                              className="w-full h-8.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 cursor-pointer"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Hubungkan ke Workspace
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs font-bold rounded-xl border-border/80"
                            >
                              <Link href={`/dashboard?action=new-workspace&vpsId=${vps.id}`}>
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Buat Workspace Baru dengan Server Ini
                              </Link>
                            </Button>
                          </div>
                        )}

                        {(isSuperAdmin || isAwaiting) && isAwaiting && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenSetup(vps)}
                            className="w-full h-8 text-[11px] font-bold rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1" />
                            Aksi IT Support: Setup Server
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* SECTION: KATALOG LAYANAN VPS & DEDICATED SERVER (HANYA TAMPIL UNTUK PELANGGAN / NON-SUPER ADMIN) */}
      {!isSuperAdmin && (
        <div id="catalog-section" className="space-y-5 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
                  Katalog Layanan VPS &amp; Dedicated Server
                </h2>
                <Badge variant="secondary" className="text-xs font-bold rounded-full px-2 py-0.5">
                  {filteredPlans.length} Paket
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pilih spesifikasi server yang sesuai dengan kebutuhan skala traffic dan penyimpanan Anda.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Category */}
              <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => setFilterCategory("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    filterCategory === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("vps")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    filterCategory === "vps" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Cloud VPS
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCategory("vds")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    filterCategory === "vds" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dedicated VDS
                </button>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/70 text-xs shadow-xs">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all",
                    billingCycle === "monthly" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5",
                    billingCycle === "yearly" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tahunan
                  <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                    Hemat 17%
                  </span>
                </button>
              </div>
            </div>
          </div>

          {viewMode === "table" ? (
            /* TABEL VIEW KATALOG */
            <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Paket Layanan</TableHead>
                    <TableHead className="text-xs font-bold">Kategori</TableHead>
                    <TableHead className="text-xs font-bold">Spesifikasi Utama</TableHead>
                    <TableHead className="text-xs font-bold">Harga ({billingCycle === "yearly" ? "Tahunan" : "Bulanan"})</TableHead>
                    <TableHead className="text-xs font-bold text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => {
                    const price = billingCycle === "yearly" && plan.yearly_price ? plan.yearly_price : plan.price
                    const isVds = plan.category === "vds"

                    return (
                      <TableRow key={plan.id} className="hover:bg-muted/40">
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground text-xs">{plan.name}</span>
                              {plan.is_popular && (
                                <Badge className="text-[9px] px-1.5 py-0 bg-primary text-primary-foreground font-black uppercase">
                                  Populer
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[280px]">
                              {plan.description || plan.desc}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[10px] font-bold capitalize">
                            {isVds ? "Dedicated VDS" : "Cloud VPS"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {plan.features?.slice(0, 3).map((f, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-[10px] text-foreground font-medium">
                                <Check className="h-2.5 w-2.5 text-emerald-600" />
                                {f}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <span className="font-black text-foreground text-sm">{formatRupiah(price)}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              /{billingCycle === "yearly" ? "tahun" : "bulan"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenOrder(plan)}
                            className="h-7.5 text-xs font-bold rounded-lg bg-primary text-primary-foreground gap-1"
                          >
                            <Zap className="h-3 w-3" />
                            Pesan
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* CARD VIEW KATALOG */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPlans.map((plan) => {
                const price = billingCycle === "yearly" && plan.yearly_price ? plan.yearly_price : plan.price
                const isPopular = plan.is_popular
                const isVds = plan.category === "vds"

                return (
                  <Card
                    key={plan.id}
                    className={cn(
                      "rounded-3xl border transition-all duration-300 flex flex-col justify-between relative overflow-hidden",
                      isPopular
                        ? "border-primary/50 shadow-md bg-gradient-to-b from-primary/5 via-card to-card"
                        : "border-border/80 bg-card hover:border-primary/30 hover:shadow-xs"
                    )}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-0">
                        <span className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs">
                          Paling Populer
                        </span>
                      </div>
                    )}

                    <CardHeader className="p-5 sm:p-6 pb-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                            {isVds ? "Dedicated VDS" : "Cloud VPS"}
                          </span>
                        </div>
                        <CardTitle className="text-lg sm:text-xl font-black tracking-tight text-foreground">
                          {plan.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {plan.description || plan.desc}
                        </CardDescription>
                      </div>

                      <div className="pt-4 border-t border-border/60">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl sm:text-3xl font-black text-foreground">
                            {formatRupiah(price)}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            /{billingCycle === "yearly" ? "tahun" : "bulan"}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6 pt-0 space-y-5">
                      <div className="space-y-2.5">
                        <p className="text-xs font-bold text-foreground">Spesifikasi &amp; Fitur:</p>
                        <ul className="space-y-2 text-xs text-muted-foreground">
                          {plan.features?.map((feat, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2">
                        <Button
                          type="button"
                          onClick={() => handleOpenOrder(plan)}
                          className={cn(
                            "w-full h-10 text-xs font-bold rounded-2xl shadow-xs cursor-pointer gap-1.5",
                            isPopular
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                          )}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Pesan Server Ini
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL ALOKASI CONTABO KE WORKSPACE (SUPER ADMIN) */}
      <Dialog open={!!assigningContabo} onOpenChange={(open) => !open && setAssigningContabo(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
          {assigningContabo && (
            <form onSubmit={handleConfirmAssignContabo} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center font-bold">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-foreground">
                      Alokasikan Contabo ke Workspace Pelanggan
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Hubungkan instance Contabo ke Workspace ID yang dipilih.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server Contabo:</span>
                  <span className="font-bold text-foreground">{assigningContabo.displayName || assigningContabo.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Public IP:</span>
                  <span className="font-mono font-bold text-foreground">{assigningContabo.ipConfig.v4.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Spesifikasi:</span>
                  <span className="font-semibold text-foreground">
                    {assigningContabo.cpuCores} vCPU | {Math.round(assigningContabo.ramMb / 1024)} GB RAM | {Math.round(assigningContabo.diskMb / 1024)} GB SSD
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-workspace" className="text-xs font-bold text-foreground">
                  Pilih Workspace Tujuan <span className="text-destructive">*</span>
                </Label>
                <select
                  id="target-workspace"
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="w-full text-xs h-10 rounded-xl bg-background border border-border/80 px-3 font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  required
                >
                  <option value="" disabled>-- Pilih Workspace --</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id.slice(0, 12)}...)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Database PostgreSQL workspace yang dipilih akan otomatis diarahkan ke instance server ini.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigningContabo(null)}
                  className="text-xs font-bold rounded-xl border-border/80"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isAssigning || !targetWorkspaceId}
                  size="sm"
                  className="text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white gap-1.5 px-4"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Mengalokasikan...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Konfirmasi Alokasi Server
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL HUBUNGKAN VPS STANDALONE KE WORKSPACE (USER/ADMIN) */}
      <Dialog open={!!assigningVps} onOpenChange={(open) => !open && setAssigningVps(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
          {assigningVps && (
            <form onSubmit={handleConfirmAssignVps} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                    <Share2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-foreground">
                      Hubungkan VPS ke Workspace
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Pilih Workspace yang akan menggunakan server dedicated ini.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Server VPS:</span>
                  <span className="font-bold text-foreground">{assigningVps.serverName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Public IP:</span>
                  <span className="font-mono font-bold text-foreground">{assigningVps.serverIp || "Dialokasikan"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paket Layanan:</span>
                  <span className="font-semibold text-foreground">{assigningVps.planName}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-vps-workspace" className="text-xs font-bold text-foreground">
                  Pilih Workspace Tujuan <span className="text-destructive">*</span>
                </Label>
                <select
                  id="target-vps-workspace"
                  value={targetWorkspaceId}
                  onChange={(e) => setTargetWorkspaceId(e.target.value)}
                  className="w-full text-xs h-10 rounded-xl bg-background border border-border/80 px-3 font-medium text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  required
                >
                  <option value="" disabled>-- Pilih Workspace --</option>
                  {workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id.slice(0, 12)}...)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Workspace ini akan beralih dari Shared Pool ke Dedicated Database PostgreSQL 17 server ini.
                </p>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssigningVps(null)}
                  className="text-xs font-bold rounded-xl border-border/80"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isAssigning || !targetWorkspaceId}
                  size="sm"
                  className="text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 px-4"
                >
                  {isAssigning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menghubungkan...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" />
                      Hubungkan ke Workspace
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL PEMESANAN VPS */}
      <Dialog open={!!selectedPlanToOrder} onOpenChange={(open) => !open && setSelectedPlanToOrder(null)}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
          {selectedPlanToOrder && (
            <form onSubmit={handleOrderSubmit} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-foreground">
                      Pemesanan {selectedPlanToOrder.name}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Server mandiri dengan setup terisolasi PostgreSQL 17 oleh tim IT Support.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="srv-name" className="text-xs font-bold text-foreground">
                    Nama / Label Server <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="srv-name"
                    value={orderForm.serverName}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, serverName: e.target.value }))}
                    placeholder="Contoh: Server Prod Intanjaya DB"
                    className="text-xs h-9.5 rounded-xl bg-background border-border/80 font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">Pilihan Siklus Tagihan</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs text-left transition-all",
                        billingCycle === "monthly" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
                      )}
                    >
                      <p className="font-bold text-foreground">Bulanan</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatRupiah(selectedPlanToOrder.price)}/bln</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "p-2.5 rounded-xl border text-xs text-left transition-all",
                        billingCycle === "yearly" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/40"
                      )}
                    >
                      <p className="font-bold text-foreground">Tahunan (Diskon)</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                        {formatRupiah(selectedPlanToOrder.yearly_price || selectedPlanToOrder.price * 10)}/thn
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="srv-notes" className="text-xs font-bold text-foreground">
                    Catatan Kebutuhan Khusus ke IT Support <span className="text-[10px] text-muted-foreground font-normal">(Opsional)</span>
                  </Label>
                  <Textarea
                    id="srv-notes"
                    value={orderForm.notes}
                    onChange={(e) => setOrderForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Contoh: Mohon gunakan region Singapore dan pasang ekstensi PostGIS."
                    className="text-xs rounded-xl bg-background border-border/80 resize-none"
                    rows={2}
                  />
                </div>

                {/* Price Breakdown */}
                <div className="rounded-2xl border border-border/70 bg-muted/40 p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Biaya Layanan VPS:</span>
                    <span className="font-bold text-foreground">
                      {formatRupiah(
                        billingCycle === "yearly" && selectedPlanToOrder.yearly_price
                          ? selectedPlanToOrder.yearly_price
                          : selectedPlanToOrder.price
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Jasa Setup &amp; Konfigurasi IT:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Rp 0 (Gratis)</span>
                  </div>
                  <div className="flex justify-between text-foreground font-black pt-1.5 border-t border-border/60 text-sm">
                    <span>Total Pembayaran:</span>
                    <span className="text-primary">
                      {formatRupiah(
                        billingCycle === "yearly" && selectedPlanToOrder.yearly_price
                          ? selectedPlanToOrder.yearly_price
                          : selectedPlanToOrder.price
                      )}
                    </span>
                  </div>
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPlanToOrder(null)}
                  className="text-xs font-bold rounded-xl border-border/80"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isOrdering || !orderForm.serverName.trim()}
                  size="sm"
                  className="text-xs font-bold rounded-xl bg-primary text-primary-foreground gap-1.5 px-4"
                >
                  {isOrdering ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Memproses Pesanan...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      Bayar &amp; Kirim ke IT Support
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL SETUP IT SUPPORT (SUPER ADMIN / TEST DEMO) */}
      <Dialog open={!!vpsToSetup} onOpenChange={(open) => !open && setVpsToSetup(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-border/80 bg-card shadow-2xl">
          {vpsToSetup && (
            <form onSubmit={handleSetupSubmit} className="space-y-4">
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-black text-foreground">
                      Aksi IT Support: Setup Server
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Masukkan IP Server dan connection string PostgreSQL 17 untuk {vpsToSetup.serverName}.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-3 text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="setup-ip" className="font-bold text-foreground">
                    IP Address Server VPS <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="setup-ip"
                    value={setupForm.serverIp}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, serverIp: e.target.value }))}
                    placeholder="161.97.100.xxx"
                    className="font-mono text-xs h-9.5 rounded-xl bg-background border-border/80"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-db" className="font-bold text-foreground">
                    Database Connection URL (PostgreSQL 17) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="setup-db"
                    value={setupForm.databaseUrl}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, databaseUrl: e.target.value }))}
                    placeholder="postgresql://user:password@ip:5432/dbname?schema=public"
                    className="font-mono text-xs h-9.5 rounded-xl bg-background border-border/80"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">Koneksi ini akan disimpan terisolasi untuk workspace user.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-notes" className="font-bold text-foreground">
                    Catatan untuk Pengguna <span className="text-[10px] text-muted-foreground font-normal">(Opsional)</span>
                  </Label>
                  <Textarea
                    id="setup-notes"
                    value={setupForm.adminNotes}
                    onChange={(e) => setSetupForm((prev) => ({ ...prev, adminNotes: e.target.value }))}
                    placeholder="Catatan pengerjaan konfigurasi..."
                    className="text-xs rounded-xl bg-background border-border/80 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVpsToSetup(null)}
                  className="text-xs font-bold rounded-xl border-border/80"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSettingUp || !setupForm.serverIp.trim() || !setupForm.databaseUrl.trim()}
                  size="sm"
                  className="text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 px-4"
                >
                  {isSettingUp ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Menyimpan Konfigurasi...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Selesaikan &amp; Aktifkan VPS
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
