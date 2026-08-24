"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Database,
  Server,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  ShieldCheck,
  Loader2,
  HardDrive,
  Layers,
  Activity,
  Cpu,
  FileText,
  Users,
  ImageIcon
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

export default function AdminDatabasesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [dbData, setDbData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const isAdmin = session?.user?.role === "super_admin" || session?.user?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/databases")
      if (res.ok) {
        const data = await res.json()
        setDbData(data)
      } else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal memuat status database & cache" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan jaringan" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchData()
    }
  }, [isAdmin])

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 min-h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-center text-muted-foreground">
        <p>Akses dibatasi khusus untuk Super Administrator.</p>
      </div>
    )
  }

  const primaryDb = dbData?.primaryDb
  const cache = dbData?.cache
  const metrics = dbData?.metrics
  const enterpriseRouting = dbData?.enterpriseRouting

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Databases & Infrastructure Routing</h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  PostgreSQL & Redis
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                Pantau koneksi database utama, integrasi cache Upstash Redis, serta *dynamic routing* untuk tenant Enterprise dengan database terisolasi.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { setRefreshing(true); fetchData(); }} 
                disabled={refreshing} 
                className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> 
                Muat Ulang
              </Button>
            </div>
          </div>

          {/* Infrastructure Health Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Primary DB Card */}
            <Card className="rounded-2xl border border-blue-500/20 bg-card shadow-xs">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        Primary PostgreSQL Database
                        {primaryDb?.status === "healthy" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-bold rounded-full">
                            Online
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] font-bold rounded-full">
                            Degraded
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {primaryDb?.pool || "Multi-tenant Shared Connection Pool"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black font-mono text-foreground">{primaryDb?.latencyMs ?? 0}ms</span>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">Query Latency</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Driver / ORM</span>
                    <span className="font-bold text-foreground font-mono">Prisma Client 6</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Connection Isolation</span>
                    <span className="font-bold text-foreground">RLS + Tenant-Scoped</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edge Cache & Redis Card */}
            <Card className="rounded-2xl border border-purple-500/20 bg-card shadow-xs">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        Upstash Redis Cache & Rate Limit
                        {cache?.status === "connected" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[9px] font-bold rounded-full">
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] font-bold rounded-full text-muted-foreground">
                            In-Memory Fallback
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Edge rate limiting & API response caching
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black font-mono text-foreground">{cache?.latencyMs ?? 0}ms</span>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold">Ping Latency</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Protocol</span>
                    <span className="font-bold text-foreground font-mono">REST / HTTP Edge</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Rate Limiting</span>
                    <span className="font-bold text-foreground">Sliding Window (100 req/min)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Database Metrics Grid */}
          <div className="grid gap-3 sm:grid-cols-5">
            <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">
                <Building2 className="w-3.5 h-3.5 text-primary" /> Workspaces
              </div>
              <p className="text-xl font-black text-foreground">{metrics?.totalTenants ?? 0}</p>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">
                <Users className="w-3.5 h-3.5 text-primary" /> Pengguna
              </div>
              <p className="text-xl font-black text-foreground">{metrics?.totalUsers ?? 0}</p>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">
                <FileText className="w-3.5 h-3.5 text-primary" /> Konten JSON
              </div>
              <p className="text-xl font-black text-foreground">{metrics?.totalContentEntries ?? 0}</p>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">
                <ImageIcon className="w-3.5 h-3.5 text-primary" /> File Media
              </div>
              <p className="text-xl font-black text-foreground">{metrics?.totalMediaFiles ?? 0}</p>
            </Card>
            <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider mb-1">
                <Activity className="w-3.5 h-3.5 text-primary" /> Audit Logs
              </div>
              <p className="text-xl font-black text-foreground">{metrics?.totalAuditLogs ?? 0}</p>
            </Card>
          </div>

          {/* Enterprise Dedicated Database Routing Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Enterprise Multi-Tenant Routing</h2>
                <p className="text-xs text-muted-foreground">
                  Status dynamic database routing via <code className="text-primary font-mono text-[11px]">lib/database.ts (getTenantDb)</code>
                </p>
              </div>
              <Badge variant="outline" className="text-xs font-bold bg-primary/10 text-primary border-primary/20 rounded-full">
                {enterpriseRouting?.totalEnterpriseTenants ?? 0} Enterprise Workspaces
              </Badge>
            </div>

            <Card className="border border-border/80 shadow-xs overflow-hidden rounded-2xl bg-card">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/60">
                      <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[220px]">
                        Workspace Enterprise
                      </th>
                      <th className="p-4 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[200px]">
                        Mode Database
                      </th>
                      <th className="p-4 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[140px]">
                        Isolasi Data
                      </th>
                      <th className="p-4 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground min-w-[160px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {!enterpriseRouting?.tenants || enterpriseRouting.tenants.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-muted-foreground">
                          <Database className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-xs font-semibold">Semua workspace saat ini berjalan pada Shared PostgreSQL Pool</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Tenant paket Enterprise dapat dikonfigurasi dengan URL Database terpisah (*Dedicated PostgreSQL*).</p>
                        </td>
                      </tr>
                    ) : (
                      enterpriseRouting.tenants.map((t: any) => (
                        <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                {t.name[0]?.toUpperCase() || "E"}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-foreground">{t.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">/{t.slug}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-bold text-foreground">{t.dbMode}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {t.hasDedicatedDb ? "Isolated Connection String" : "Managed Shared Cluster"}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {t.hasDedicatedDb ? (
                              <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 text-[10px] font-bold rounded-full">
                                Dedicated DB Instance
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground rounded-full">
                                Shared Pool Partition
                              </Badge>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
                              Active & Routing
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
