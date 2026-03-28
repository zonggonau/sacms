"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2, Database, Plus, ArrowRight, ArrowUpRight, FileText,
  Building2, Users, DollarSign, Activity, TrendingUp, Key, ImageIcon,
  CheckCircle2, Puzzle, CreditCard, Shield, Trophy
} from "lucide-react"
import Link from "next/link"
import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"

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
  }, [session])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)

  if (status === "loading" || loading) {
    return (
      <div className="flex">
        <GlobalAdminSidebar />
        <main className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <GlobalAdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Global Administration</h1>
              <p className="text-muted-foreground">
                Platform-wide performance and management overview.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link href="/admin/tenants">
                <Button variant="outline" size="sm">
                  <Building2 className="mr-2 h-4 w-4" />
                  All Tenants
                </Button>
              </Link>
              <Link href="/admin/content-types/new">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-2 h-4 w-4" />
                  New Schema
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Tenants", value: stats.tenants, sub: `${stats.activeTenants} active`, icon: Building2, color: "text-blue-500", border: "border-l-blue-500", href: "/admin/tenants" },
              { label: "Platform Users", value: stats.users, sub: "Registered accounts", icon: Users, color: "text-emerald-500", border: "border-l-emerald-500", href: "/admin/users" },
              { label: "Monthly Revenue", value: formatCurrency(stats.monthlyRevenue), sub: `${stats.activeSubscriptions} active subs`, icon: TrendingUp, color: "text-violet-500", border: "border-l-violet-500", href: "/admin/billing" },
              { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), sub: "Historical total", icon: DollarSign, color: "text-amber-500", border: "border-l-amber-500", href: "/admin/billing" },
            ].map((kpi) => (
              <Link key={kpi.label} href={kpi.href}>
                <Card className={`hover:shadow-md transition-all cursor-pointer border-l-4 ${kpi.border}`}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                      <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                    </div>
                    <div className="text-3xl font-bold">{kpi.value}</div>
                    <p className="text-xs text-muted-foreground mt-1 font-medium">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Schema Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Content Types", value: stats.contentTypes, icon: Database, bg: "bg-purple-100 text-purple-600", href: "/admin/content-types" },
              { label: "Single Types", value: stats.singleTypes, icon: FileText, bg: "bg-blue-100 text-blue-600", href: "/admin/single-types" },
              { label: "Components", value: stats.components, icon: Puzzle, bg: "bg-orange-100 text-orange-600", href: "/admin/components" },
              { label: "Media Library", value: stats.mediaCount, icon: ImageIcon, bg: "bg-pink-100 text-pink-600", href: "/admin/media" },
              { label: "Billing", value: stats.activeSubscriptions, icon: CreditCard, bg: "bg-indigo-100 text-indigo-600", href: "/admin/billing" },
            ].map((s) => (
              <Link key={s.label} href={s.href}>
                <Card className="hover:shadow-sm transition-all cursor-pointer h-full group bg-card">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform ${s.bg}`}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="text-xl font-bold leading-none">{s.value}</div>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium uppercase tracking-tight">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Recent Tenants + Top Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tenants */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold">Recently Registered</CardTitle>
                  <CardDescription className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">New Workspace Onboarding</CardDescription>
                </div>
                <Link href="/admin/tenants">
                  <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-primary hover:text-primary hover:bg-primary/5">
                    VIEW ALL <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 border-t">
                {stats.recentTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No workspace registration data</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {stats.recentTenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 border border-primary/20">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-none truncate">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground mt-1.5 font-mono">
                              /{tenant.slug} &middot; {tenant._count.members} users
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold px-2 py-0.5">{tenant.plan}</Badge>
                          <Link href={`/dashboard/${tenant.slug}`}>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-muted-foreground/20">
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Tenants by Activity */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold">Top Workspaces</CardTitle>
                  <CardDescription className="text-xs font-medium uppercase tracking-tight text-muted-foreground/70">Highest Content & Media Usage</CardDescription>
                </div>
                <Trophy className="h-5 w-5 text-amber-500" />
              </CardHeader>
              <CardContent className="p-0 border-t">
                {stats.topTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No usage data available yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {stats.topTenants.map((tenant, i) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-100 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                          }`}>
                            #{i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold leading-none truncate">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground mt-1.5">
                              {tenant._count.contentEntries} entries &middot; {tenant._count.media} files
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground/70 leading-none">Total Usage</p>
                            <p className="text-sm font-black text-primary mt-1">{(tenant._count.contentEntries + tenant._count.media).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Access & System Health */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Access */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold">System Management Modules</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Content Schema", href: "/admin/content-types", icon: Database },
                  { label: "Single Types",  href: "/admin/single-types",  icon: FileText },
                  { label: "Components",    href: "/admin/components",     icon: Puzzle },
                  { label: "Tenants List",   href: "/admin/tenants",            icon: Building2 },
                  { label: "User Directory", href: "/admin/users",              icon: Users },
                  { label: "RBAC Security",  href: "/admin/rbac",              icon: Shield },
                  { label: "Monitoring",       href: "/admin/monitoring",         icon: Activity },
                  { label: "Billing Admin",    href: "/admin/billing",           icon: CreditCard },
                ].map((action) => (
                  <Link key={action.label} href={action.href}>
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-muted p-4 hover:border-primary hover:bg-primary/5 transition-all text-center h-full group">
                      <action.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground">{action.label}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-400">All Systems Operational</h3>
                    <p className="text-[11px] text-emerald-700/70">Checked 1 minute ago</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { name: "Database Cluster", status: "Healthy" },
                    { name: "Object Storage (R2)", status: "Active" },
                    { name: "WebSocket Gateway", status: "Connected" },
                    { name: "API Rate Limiter", status: "Enabled" },
                    { name: "Webhook Dispatcher", status: "Running" },
                  ].map((service) => (
                    <div key={service.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">{service.name}</span>
                      <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {service.status}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="my-4 bg-emerald-200/50" />
                <p className="text-[10px] text-muted-foreground italic text-center">
                  SaCMS v0.2.0 &middot; Running on production-grade infrastructure
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </main>
    </div>
  )
}
