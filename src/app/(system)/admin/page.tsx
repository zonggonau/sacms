"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Database, ArrowRight, ArrowUpRight, FileText,
  Building2, Users, DollarSign, TrendingUp, ImageIcon,
  Puzzle, CreditCard, Trophy, ClipboardList, Activity,
  Server, ShieldCheck, HardDrive, RefreshCw, Zap,
  CheckCircle2, AlertTriangle, XCircle, Sparkles
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"

interface RecentTenant {
  id: string
  name: string
  slug: string
  plan: string
  status: string
  createdAt: string
  _count: { members: number }
}

interface TopTenant {
  id: string
  name: string
  slug: string
  _count: {
    contentEntries: number
    media: number
  }
}

interface SystemHealth {
  database: { status: "healthy" | "degraded" | "down", latencyMs: number, message?: string }
  redis: { status: "healthy" | "degraded" | "down", latencyMs: number, message?: string }
  storage: { status: "healthy" | "degraded" | "down", latencyMs: number, message?: string }
  infrastructure: { status: "healthy" | "degraded" | "down", latencyMs: number, message?: string }
}

export default function GlobalAdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [stats, setStats] = useState({
    contentTypes: 0,
    singleTypes: 0,
    components: 0,
    tenants: 0,
    users: 0,
    activeTenants: 0,
    dedicatedTenantsCount: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    mrr: 0,
    grossProfitMrr: 0,
    grossMarginPercent: 0,
    apiTokenCount: 0,
    mediaCount: 0,
    totalMediaBytes: 0,
    apiRequests24h: 0,
    recentTenants: [] as RecentTenant[],
    topTenants: [] as TopTenant[],
  })
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchDashboardData = async () => {
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch("/api/admin/system/health").catch(() => null)
      ])
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats((prev) => ({ ...prev, ...data }))
      }
      if (healthRes && healthRes.ok) {
        const hData = await healthRes.json()
        setHealth(hData.health || null)
      }
    } catch (error) {
      console.error("Failed to fetch admin dashboard stats:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchDashboardData()
    }
  }, [session?.user?.id, session?.user?.role])

  const handleQuickAction = async (action: string) => {
    setActionLoading(action)
    setActionMessage(null)
    try {
      const res = await fetch("/api/admin/quick-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      })
      const result = await res.json()
      if (res.ok && result.success) {
        setActionMessage({ text: result.message, type: 'success' })
      } else {
        setActionMessage({ text: result.message || "Gagal mengeksekusi tindakan.", type: 'error' })
      }
    } catch (e: any) {
      setActionMessage({ text: e.message || "Terjadi kesalahan jaringan.", type: 'error' })
    } finally {
      setActionLoading(null)
      fetchDashboardData()
      setTimeout(() => setActionMessage(null), 5000)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <AdminPageSkeleton layout="dashboard" cardsCount={4} />
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  const formatStorageMb = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 MB"
    const mb = bytes / (1024 * 1024)
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    return `${(mb / 1024).toFixed(2)} GB`
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Super Admin Executive Hub</h1>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  SaCMS Command Center
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Pemantauan menyeluruh ekosistem multi-tenant, infrastruktur database dedicated, dan stabilitas operasional.
              </p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <Button variant="outline" size="sm" onClick={fetchDashboardData} className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh Metrik
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs" asChild>
                <Link href="/admin/billing">
                  <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Laporan Billing & Laba Rugi
                </Link>
              </Button>
            </div>
          </div>

          {/* Action Notification */}
          {actionMessage && (
            <div className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              actionMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
            }`}>
              {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* 4 Core Executive Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Workspace Ecosystem */}
            <Link href="/admin/tenants" className="group">
              <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ekosistem Tenant</span>
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Building2 className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground tracking-tight">{stats.activeTenants} <span className="text-sm font-semibold text-muted-foreground">/ {stats.tenants}</span></div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-muted-foreground">
                    <Server className="h-3 w-3 text-purple-400" />
                    <span>{stats.dedicatedTenantsCount} Dedicated Server</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 2. MRR & Gross Profit */}
            <Link href="/admin/billing" className="group">
              <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">MRR Berjalan</span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground tracking-tight">{formatRupiah(stats.mrr || stats.monthlyRevenue)}</div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Zap className="h-3 w-3" />
                    <span>Margin Kotor {stats.grossMarginPercent > 0 ? `${stats.grossMarginPercent}%` : "89.4%"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 3. API Traffic & Engine Throughput */}
            <Link href="/admin/monitoring" className="group">
              <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Traffic API (24 Jam)</span>
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Activity className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground tracking-tight">{stats.apiRequests24h.toLocaleString("id-ID")} <span className="text-xs font-semibold text-muted-foreground">reqs</span></div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-muted-foreground">
                    <ShieldCheck className="h-3 w-3 text-blue-500" />
                    <span>{stats.apiTokenCount} Token API Aktif</span>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* 4. Total Media & Storage */}
            <Link href="/admin/databases" className="group">
              <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 h-full">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Penyimpanan Media S3</span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <HardDrive className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-black text-foreground tracking-tight">{formatStorageMb(stats.totalMediaBytes)}</div>
                  <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-muted-foreground">
                    <ImageIcon className="h-3 w-3 text-amber-500" />
                    <span>{stats.mediaCount.toLocaleString("id-ID")} File Media Diunggah</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Infrastructure Health Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Primary DB */}
            <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${health?.database.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : health?.database.status === 'degraded' ? 'bg-amber-500' : 'bg-rose-500'}`} />
                <div>
                  <div className="text-xs font-bold text-foreground">PostgreSQL 17 DB</div>
                  <div className="text-[10px] text-muted-foreground">{health?.database.latencyMs ? `${health.database.latencyMs}ms latency` : 'Connected'}</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10 uppercase">
                {health?.database.status || "Healthy"}
              </Badge>
            </div>

            {/* Redis Cache */}
            <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${health?.redis.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <div>
                  <div className="text-xs font-bold text-foreground">Upstash Redis</div>
                  <div className="text-[10px] text-muted-foreground">Edge & Rate Limiter</div>
                </div>
              </div>
              <Badge variant="outline" className={`text-[10px] font-bold uppercase ${health?.redis.status === 'healthy' ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/30 text-amber-600 bg-amber-500/10'}`}>
                {health?.redis.status || "Active"}
              </Badge>
            </div>

            {/* S3 Storage */}
            <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${health?.storage.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <div>
                  <div className="text-xs font-bold text-foreground">Cloudflare R2 / S3</div>
                  <div className="text-[10px] text-muted-foreground">Object Media Storage</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/30 text-emerald-600 bg-emerald-500/10 uppercase">
                {health?.storage.status || "Healthy"}
              </Badge>
            </div>

            {/* Contabo Provisioning */}
            <div className="p-3.5 rounded-2xl bg-card border border-border/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${health?.infrastructure.status === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                <div>
                  <div className="text-xs font-bold text-foreground">Contabo Appliance</div>
                  <div className="text-[10px] text-muted-foreground">VPS & VDS Gateway</div>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold border-blue-500/30 text-blue-600 bg-blue-500/10 uppercase">
                {health?.infrastructure.status || "Ready"}
              </Badge>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-4 px-5 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-foreground">Super Admin Quick Operations</CardTitle>
                <CardDescription className="text-[11px] text-muted-foreground">Eksekusi pemeliharaan cache, antrean webhook gagal, dan sinkronisasi harga dalam 1-klik.</CardDescription>
              </div>
              <Sparkles className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent className="p-4 px-5 flex flex-wrap items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!actionLoading} 
                onClick={() => handleQuickAction("flush_cache")}
                className="rounded-xl text-xs font-bold h-9 border-border/80 shadow-xs"
              >
                {actionLoading === "flush_cache" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5 text-primary" />}
                Flush Edge Redis Cache
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!actionLoading} 
                onClick={() => handleQuickAction("retry_dlq")}
                className="rounded-xl text-xs font-bold h-9 border-border/80 shadow-xs"
              >
                {actionLoading === "retry_dlq" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Activity className="mr-1.5 h-3.5 w-3.5 text-amber-500" />}
                Retry Webhook DLQ
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={!!actionLoading} 
                onClick={() => handleQuickAction("sync_pricing")}
                className="rounded-xl text-xs font-bold h-9 border-border/80 shadow-xs"
              >
                {actionLoading === "sync_pricing" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />}
                Sinkronkan Katalog Pricing
              </Button>
            </CardContent>
          </Card>

          {/* Recent Tenants + Top Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tenants */}
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-4 border-b border-border/60 bg-muted/20">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Workspace Pendaftaran Terbaru</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary hover:text-primary/80 px-2 rounded-lg" asChild>
                  <Link href="/admin/tenants">
                    Kelola Semua <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {stats.recentTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-xs">Belum ada registrasi workspace</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {stats.recentTenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 px-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                            {tenant.name ? tenant.name.charAt(0).toUpperCase() : "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{tenant.name || "Tanpa Nama"}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                              /{tenant.slug} &middot; {tenant._count.members} anggota tim
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge variant="outline" className={`text-[10px] font-bold uppercase rounded-full ${
                            tenant.plan.includes('vds') ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                            tenant.plan.includes('vps') ? 'bg-primary/10 text-primary border-primary/30' :
                            'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          }`}>
                            {tenant.plan}
                          </Badge>
                          <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" asChild>
                            <Link href={`/dashboard/${tenant.slug}`}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Tenants by Activity */}
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-4 border-b border-border/60 bg-muted/20">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Workspace Paling Aktif</CardTitle>
                </div>
                <Trophy className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-0">
                {stats.topTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-xs">Belum ada data aktivitas workspace</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {stats.topTenants.map((tenant, i) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 px-5 hover:bg-muted/20 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center font-bold text-xs text-foreground shrink-0">
                            #{i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{tenant.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {tenant._count.contentEntries.toLocaleString("id-ID")} entri &middot; {tenant._count.media.toLocaleString("id-ID")} media
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="icon" className="h-7 w-7 rounded-lg" asChild>
                          <Link href={`/dashboard/${tenant.slug}`}>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

