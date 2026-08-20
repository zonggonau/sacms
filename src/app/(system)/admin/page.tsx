"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, Database, ArrowRight, ArrowUpRight, FileText,
  Building2, Users, DollarSign, TrendingUp, ImageIcon,
  Puzzle, CreditCard, Trophy
} from "lucide-react"
import Link from "next/link"
import { formatRupiah } from "@/lib/utils"

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
    activeSubscriptions: 0,
    totalRevenue: 0,
    monthlyRevenue: 0,
    apiTokenCount: 0,
    mediaCount: 0,
    recentTenants: [] as RecentTenant[],
    topTenants: [] as TopTenant[],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats")
        if (res.ok) {
          const data = await res.json()
          setStats((prev) => ({ ...prev, ...data }))
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user?.role === "super_admin") {
      fetchStats()
    }
  }, [session?.user?.id, session?.user?.role])

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 min-h-[80vh] flex items-center justify-center flex-col w-full bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Admin Super Panel</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  Global Overview
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pemantauan metrik platform, tenant workspace, dan kesehatan ekosistem SaCMS.
              </p>
            </div>
            <div className="flex gap-2.5 shrink-0">
              <Button variant="outline" className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80" asChild>
                <Link href="/dashboard">
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  Ke Dashboard Tenant
                </Link>
              </Button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Workspace", value: stats.tenants, sub: `${stats.activeTenants} workspace aktif`, icon: Building2, href: "/admin/tenants" },
              { label: "Pengguna Platform", value: stats.users, sub: "Akun terdaftar", icon: Users, href: "/admin/users" },
              { label: "Pendapatan Bulanan", value: formatRupiah(stats.monthlyRevenue), sub: `${stats.activeSubscriptions} langganan aktif`, icon: TrendingUp, href: "/admin/billing" },
              { label: "Total Pendapatan", value: formatRupiah(stats.totalRevenue), sub: "Akumulasi historis", icon: DollarSign, href: "/admin/billing" },
            ].map((kpi) => (
              <Link key={kpi.label} href={kpi.href} className="group">
                <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <kpi.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="text-2xl font-black text-foreground tracking-tight">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Schema Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              { label: "Tipe Konten", value: stats.contentTypes, icon: Database, href: "/admin/content-types" },
              { label: "Halaman Statis", value: stats.singleTypes, icon: FileText, href: "/admin/single-types" },
              { label: "Komponen", value: stats.components, icon: Puzzle, href: "/admin/component" },
              { label: "Langganan Aktif", value: stats.activeSubscriptions, icon: CreditCard, href: "/admin/billing" },
            ].map((s) => (
              <Link key={s.label} href={s.href} className="group">
                <Card className="rounded-2xl border border-border/80 bg-card shadow-xs hover:shadow-md hover:border-primary/40 transition-all duration-200 h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className="w-9 h-9 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground mb-2.5 group-hover:text-primary group-hover:bg-primary/10 transition-colors">
                      <s.icon className="h-4 w-4" />
                    </div>
                    <div className="text-xl font-black text-foreground mb-0.5">{s.value}</div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Recent Tenants + Top Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tenants */}
            <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-4 border-b border-border/60 bg-muted/20">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">Workspace Terbaru</CardTitle>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-primary hover:text-primary/80 px-2 rounded-lg" asChild>
                  <Link href="/admin/tenants">
                    Lihat Semua <ArrowRight className="ml-1 h-3.5 w-3.5" />
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
                              /{tenant.slug} &middot; {tenant._count.members} anggota
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full border-border/80">{tenant.plan}</Badge>
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
                <Trophy className="h-4 w-4 text-primary" />
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
                              {tenant._count.contentEntries} entri konten &middot; {tenant._count.media} aset media
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
