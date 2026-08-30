"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Plus, Building2, Search, Settings, 
  MoreVertical, Trash2, AlertTriangle, Clock,
  ArrowRight, Zap, CheckCircle2, ExternalLink,
  Crown, LayoutGrid, List, Layers, ShieldCheck, Globe, Copy, Check, Lock
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { deleteTenantAction } from "@/actions/tenant"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { WorkspaceCreationDialog } from "./workspace-creation-dialog"
import { EnterpriseLicenseBanner } from "./enterprise-license-banner"

interface Tenant {
  id: string
  name: string
  slug: string
  status: string
  plan: string
  role: string
  daysRemaining: number | null
  expiresAt: string | null
  createdAt: string
  subscriptionStatus: string | null
  isExpired?: boolean
  isEnterprise?: boolean
}

interface WorkspaceManagerProps {
  initialTenants: Tenant[]
  usage: { current: number; max: number | null; allowed: boolean; plan: string } | null
  dbTemplates: any[]
  workspacePlans: any[]
  addonPlans: any[]
  isSuperAdmin?: boolean
}

export function WorkspaceManager({
  initialTenants,
  usage,
  dbTemplates,
  workspacePlans,
  addonPlans,
  isSuperAdmin
}: WorkspaceManagerProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creationTemplateId, setCreationTemplateId] = useState("custom")

  // Delete State
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null)

  const filteredTenants = initialTenants.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const expiredCount = initialTenants.filter(t => t.isExpired || (t.daysRemaining !== null && t.daysRemaining <= 0 && t.status !== "active")).length
  const expiringSoonCount = initialTenants.filter(t => !t.isExpired && t.daysRemaining !== null && t.daysRemaining <= 3 && t.daysRemaining > 0).length
  const activeWorkspacesCount = initialTenants.filter(t => !t.isExpired && t.status === 'active' && (t.daysRemaining === null || t.daysRemaining > 0)).length
  const suspendedCount = initialTenants.length - activeWorkspacesCount

  const handleCopySlug = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`${slug}.sacms.cloud`)
    setCopiedSlug(slug)
    toast({ title: "Tersalin", description: `URL ${slug}.sacms.cloud disalin ke clipboard.` })
    setTimeout(() => setCopiedSlug(null), 2000)
  }

  const handleDeleteTenant = async () => {
    if (!tenantToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteTenantAction(tenantToDelete.id)
      if (res.success) {
        toast({ title: "Workspace Dihapus", description: "Semua data workspace telah dihapus secara permanen." })
        setTenantToDelete(null)
        setDeleteConfirm("")
        router.refresh()
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan saat menghapus workspace." })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Enterprise License Notice */}
      <EnterpriseLicenseBanner hideActivation={true} />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Workspace</h1>
            <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
              {initialTenants.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Kelola dan akses semua workspace serta sistem manajemen konten proyek Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSuperAdmin && (
            <Button variant="outline" size="sm" asChild className="h-9 px-3 text-xs font-bold rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
              <Link href="/admin">
                <Crown className="mr-1.5 h-3.5 w-3.5" />
                Super Admin
              </Link>
            </Button>
          )}

          {usage && (
            <div className="text-xs px-3 py-1.5 bg-muted/50 rounded-xl flex items-center gap-2 border border-border/80 font-medium text-muted-foreground h-9">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>Kapasitas:</span>
              <span className={cn("font-bold text-foreground", !usage.allowed && "text-destructive")}>
                {usage.current} / {usage.max === null || usage.max > 9000 ? "Unlimited" : usage.max}
              </span>
            </div>
          )}

          <Button 
            className="h-9 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all"
            onClick={() => { 
              if (usage && !usage.allowed) {
                toast({ variant: "destructive", title: "Batas Tercapai", description: `Anda telah mencapai batas maksimum workspace untuk paket ${usage.plan}.` })
                return
              }
              setCreationTemplateId("custom")
              setIsCreateOpen(true) 
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Workspace Baru
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground">Total Workspace</p>
              <p className="text-2xl font-black text-foreground">{initialTenants.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground">Proyek Aktif</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeWorkspacesCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/80 bg-card rounded-2xl shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground">Status Berlangganan</p>
              <p className="text-sm font-bold text-foreground">
                {expiredCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">{expiredCount} Masa Percobaan Berakhir</span>
                ) : expiringSoonCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{expiringSoonCount} Segera Berakhir</span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">Semua Berjalan Normal</span>
                )}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center text-muted-foreground">
              {expiredCount > 0 ? (
                <Lock className="h-5 w-5 text-amber-500" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Cari nama atau slug workspace..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl border-border/80 bg-card"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center p-0.5 bg-muted/40 rounded-xl border border-border/80">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2.5 rounded-lg text-xs font-semibold transition-all",
                viewMode === "grid" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Grid
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-2.5 rounded-lg text-xs font-semibold transition-all",
                viewMode === "table" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5 mr-1" /> Tabel
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace Presentation */}
      <section className="space-y-4">
        {initialTenants.length === 0 ? (
          <Card className="py-16 text-center border-dashed rounded-2xl bg-card/60">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Belum ada workspace</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Mulai dengan membuat workspace pertama Anda untuk mengelola konten dan API.
                </p>
              </div>
              <Button 
                onClick={() => setIsCreateOpen(true)} 
                className="mt-2 h-9 px-4 text-xs font-bold rounded-xl bg-primary text-primary-foreground"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Buat Workspace Baru
              </Button>
            </CardContent>
          </Card>
        ) : filteredTenants.length === 0 ? (
          <Card className="py-12 text-center rounded-2xl bg-card/40">
            <CardContent className="space-y-2">
              <Search className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
              <p className="text-sm font-semibold text-foreground">Workspace tidak ditemukan</p>
              <p className="text-xs text-muted-foreground">Tidak ada workspace yang cocok dengan "{searchQuery}"</p>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          /* GRID VIEW (Modern Cards) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTenants.map((tenant) => {
              const isOwnerOrAdmin = ['owner', 'admin'].includes(tenant.role) || isSuperAdmin
              const isTenantExpired = Boolean(tenant.isExpired || (tenant.daysRemaining !== null && tenant.daysRemaining <= 0 && tenant.status !== "active"))
              const targetUrl = tenant.status === 'provisioning' ? '#' : (isOwnerOrAdmin ? `/dashboard/${tenant.id}` : `/dashboard/${tenant.id}/cms`)
              const isProvisioning = tenant.status === 'provisioning'
              const isSuspended = tenant.status === 'suspended'

              return (
                <Card 
                  key={tenant.id} 
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md transition-all duration-200 group overflow-hidden",
                    isTenantExpired && "border-amber-500/40 bg-amber-500/[0.02]",
                    isSuspended && !isTenantExpired && "border-destructive/40 bg-destructive/[0.02]"
                  )}
                >
                  <CardHeader className="p-4 pb-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 font-black text-sm",
                          isTenantExpired 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                            : "bg-primary/10 border-primary/20 text-primary"
                        )}>
                          {isTenantExpired ? (
                            <Lock className="w-4 h-4" />
                          ) : (
                            tenant.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link 
                            href={targetUrl}
                            onClick={(e) => isProvisioning && e.preventDefault()}
                            className={cn(
                              "font-bold text-sm text-foreground hover:text-primary transition-colors line-clamp-1",
                              isProvisioning && "pointer-events-none opacity-60"
                            )}
                          >
                            {tenant.name}
                          </Link>
                          <button
                            type="button"
                            onClick={(e) => handleCopySlug(tenant.slug, e)}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors mt-0.5"
                            title="Klik untuk salin domain"
                          >
                            <span>{tenant.slug}.sacms.cloud</span>
                            {copiedSlug === tenant.slug ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
                            )}
                          </button>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-48">
                          <DropdownMenuLabel className="text-xs">Kelola Workspace</DropdownMenuLabel>
                          {isOwnerOrAdmin ? (
                            <>
                              <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                <Link href={`/dashboard/${tenant.id}`}>
                                  <Layers className="mr-2 h-3.5 w-3.5" /> Ringkasan Workspace
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                <Link href={`/dashboard/${tenant.id}/cms`}>
                                  <ExternalLink className="mr-2 h-3.5 w-3.5" /> CMS Content Studio
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                <Link href={`/dashboard/${tenant.id}/settings`}>
                                  <Settings className="mr-2 h-3.5 w-3.5" /> Pengaturan
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                <Link href={`/dashboard/${tenant.id}/subscriptions`}>
                                  <Zap className="mr-2 h-3.5 w-3.5" /> Langganan & Paket
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:bg-destructive focus:text-destructive-foreground text-xs cursor-pointer rounded-lg"
                                onClick={() => { setTenantToDelete(tenant); setDeleteConfirm(""); }}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Workspace
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                              <Link href={`/dashboard/${tenant.id}/cms`}>
                                <ExternalLink className="mr-2 h-3.5 w-3.5" /> CMS Content Studio
                              </Link>
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Meta Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {isProvisioning ? (
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                          <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> Setup
                        </Badge>
                      ) : isTenantExpired ? (
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Masa Percobaan Berakhir
                        </Badge>
                      ) : isSuspended ? (
                        <Badge variant="destructive" className="text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Ditangguhkan
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Aktif
                        </Badge>
                      )}

                      <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {tenant.plan}
                      </Badge>

                      <Badge variant="outline" className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full border-border/80 text-muted-foreground">
                        {tenant.role.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 border-t border-border/60">
                    <Button 
                      asChild 
                      disabled={isProvisioning}
                      className={cn(
                        "w-full h-8 text-xs font-bold rounded-xl transition-all shadow-xs",
                        isTenantExpired
                          ? "bg-amber-500 hover:bg-amber-600 text-white dark:text-black shadow-amber-500/20"
                          : isOwnerOrAdmin 
                            ? "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground" 
                            : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      <Link href={isTenantExpired ? `/dashboard/${tenant.id}/subscriptions` : targetUrl} onClick={(e) => isProvisioning && e.preventDefault()}>
                        {isTenantExpired ? "Pilih Paket Langganan" : isOwnerOrAdmin ? "Buka Workspace" : "Buka CMS Studio"}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          /* TABLE VIEW (Minimalist List) */
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs font-bold">Workspace</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold">Paket</TableHead>
                  <TableHead className="text-xs font-bold">Role Anda</TableHead>
                  <TableHead className="text-xs font-bold text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => {
                  const isOwnerOrAdmin = ['owner', 'admin'].includes(tenant.role) || isSuperAdmin
                  const isTenantExpired = Boolean(tenant.isExpired || (tenant.daysRemaining !== null && tenant.daysRemaining <= 0 && tenant.status !== "active"))
                  const targetUrl = tenant.status === 'provisioning' ? '#' : (isOwnerOrAdmin ? `/dashboard/${tenant.id}` : `/dashboard/${tenant.id}/cms`)
                  const isProvisioning = tenant.status === 'provisioning'
                  const isSuspended = tenant.status === 'suspended'

                  return (
                    <TableRow key={tenant.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs",
                            isTenantExpired 
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-primary/10 text-primary"
                          )}>
                            {isTenantExpired ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              tenant.name.substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-foreground line-clamp-1">{tenant.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{tenant.slug}.sacms.cloud</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        {isProvisioning ? (
                          <Badge variant="outline" className="text-[10px] font-bold text-blue-500 border-blue-200 bg-blue-50">
                            <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> Setup
                          </Badge>
                        ) : isTenantExpired ? (
                          <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Masa Percobaan Berakhir
                          </Badge>
                        ) : isSuspended ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">Ditangguhkan</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                            Aktif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                          {tenant.plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge variant="outline" className="text-[10px] capitalize border-border text-muted-foreground">
                          {tenant.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button 
                            size="sm" 
                            variant={isTenantExpired ? "default" : "secondary"}
                            asChild
                            disabled={isProvisioning}
                            className={cn(
                              "h-8 px-3 text-xs font-bold rounded-lg",
                              isTenantExpired && "bg-amber-500 hover:bg-amber-600 text-white dark:text-black shadow-xs"
                            )}
                          >
                            <Link href={isTenantExpired ? `/dashboard/${tenant.id}/subscriptions` : targetUrl} onClick={(e) => isProvisioning && e.preventDefault()}>
                              {isTenantExpired ? "Langganan" : "Buka"} <ArrowRight className="ml-1.5 h-3 w-3" />
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-48">
                              <DropdownMenuLabel className="text-xs">Kelola Workspace</DropdownMenuLabel>
                              {isOwnerOrAdmin ? (
                                <>
                                  <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                    <Link href={`/dashboard/${tenant.id}/settings`}>
                                      <Settings className="mr-2 h-3.5 w-3.5" /> Pengaturan
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                    <Link href={`/dashboard/${tenant.id}/subscriptions`}>
                                      <Zap className="mr-2 h-3.5 w-3.5" /> Langganan
                                    </Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:bg-destructive focus:text-destructive-foreground text-xs cursor-pointer rounded-lg"
                                    onClick={() => { setTenantToDelete(tenant); setDeleteConfirm(""); }}
                                  >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Workspace
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem asChild className="text-xs cursor-pointer rounded-lg">
                                  <Link href={`/dashboard/${tenant.id}/cms`}>
                                    <ExternalLink className="mr-2 h-3.5 w-3.5" /> CMS Content Studio
                                  </Link>
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Creation Modal */}
      <WorkspaceCreationDialog 
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        dbTemplates={dbTemplates}
        workspacePlans={workspacePlans}
        addonPlans={addonPlans}
        initialTemplateId={creationTemplateId}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!tenantToDelete} onOpenChange={(open) => !open && setTenantToDelete(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Hapus Workspace?</DialogTitle>
            <DialogDescription className="text-xs">
              Tindakan ini akan menghapus workspace <strong>"{tenantToDelete?.name}"</strong> beserta seluruh skema, media, dan entri kontennya secara permanen.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Ketik <span className="font-bold text-foreground font-mono">{tenantToDelete?.name}</span> untuk konfirmasi:</Label>
            <Input 
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Nama workspace persis"
              className="text-xs rounded-xl"
            />
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setTenantToDelete(null)} className="rounded-xl text-xs">
              Batal
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirm !== tenantToDelete?.name || isDeleting}
              onClick={handleDeleteTenant}
              className="rounded-xl text-xs font-bold"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

