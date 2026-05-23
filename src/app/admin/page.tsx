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
  Building2, Users, DollarSign, Activity, TrendingUp, ImageIcon,
  CheckCircle2, Puzzle, CreditCard, Shield, Trophy
} from "lucide-react"
import Link from "next/link"
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
      <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex text-foreground flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 md:p-10 space-y-8 w-full">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Global platform overview and metrics.
              </p>
            </div>
            <div className="flex gap-3 shrink-0">
              <Link href="/admin/tenants">
                <Button variant="outline" className="rounded-none border-border">
                  <Building2 className="mr-2 h-4 w-4" />
                  All Tenants
                </Button>
              </Link>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Tenants", value: stats.tenants, sub: `${stats.activeTenants} active`, icon: Building2, href: "/admin/tenants" },
              { label: "Platform Users", value: stats.users, sub: "Registered accounts", icon: Users, href: "/admin/users" },
              { label: "Monthly Revenue", value: formatCurrency(stats.monthlyRevenue), sub: `${stats.activeSubscriptions} active subs`, icon: TrendingUp, href: "/admin/billing" },
              { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), sub: "Historical total", icon: DollarSign, href: "/admin/billing" },
            ].map((kpi) => (
              <Link key={kpi.label} href={kpi.href}>
                <Card className="rounded-none border border-border shadow-none hover:bg-background transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{kpi.label}</span>
                      <kpi.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="text-3xl font-bold text-foreground">{kpi.value}</div>
                    <p className="text-sm text-muted-foreground mt-1">{kpi.sub}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Schema Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: "Content Types", value: stats.contentTypes, icon: Database, href: "/admin/content-types" },
              { label: "Single Types", value: stats.singleTypes, icon: FileText, href: "/admin/single-types" },
              { label: "Components", value: stats.components, icon: Puzzle, href: "/admin/components" },
              { label: "Media Library", value: stats.mediaCount, icon: ImageIcon, href: "/admin/media" },
              { label: "Billing", value: stats.activeSubscriptions, icon: CreditCard, href: "/admin/billing" },
            ].map((s) => (
              <Link key={s.label} href={s.href}>
                <Card className="rounded-none border border-border shadow-none hover:bg-background transition-colors h-full">
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <s.icon className="h-6 w-6 text-muted-foreground mb-4" />
                    <div className="text-2xl font-bold text-foreground mb-1">{s.value}</div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{s.label}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Recent Tenants + Top Tenants */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Tenants */}
            <Card className="rounded-none border border-border shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border px-6 py-4 bg-card">
                <div>
                  <CardTitle className="text-lg font-bold">Recently Registered</CardTitle>
                </div>
                <Link href="/admin/tenants">
                  <Button variant="ghost" size="sm" className="h-8 text-sm font-semibold text-orange-500 hover:text-orange-600 hover:bg-transparent px-0">
                    View All <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 bg-card">
                {stats.recentTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No workspace registration data</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200">
                    {stats.recentTenants.map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-background transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-muted flex items-center justify-center font-bold text-foreground shrink-0 border border-border">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 font-mono">
                              /{tenant.slug} &middot; {tenant._count.members} users
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className="text-xs font-semibold rounded-none border-border">{tenant.plan}</Badge>
                          <Link href={`/dashboard/${tenant.slug}`}>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-none border-border">
                              <ArrowUpRight className="h-4 w-4" />
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
            <Card className="rounded-none border border-border shadow-none">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border px-6 py-4 bg-card">
                <div>
                  <CardTitle className="text-lg font-bold">Top Workspaces</CardTitle>
                </div>
                <Trophy className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-0 bg-card">
                {stats.topTenants.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">No usage data available yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200">
                    {stats.topTenants.map((tenant, i) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 hover:bg-background transition-colors">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="w-10 h-10 bg-muted flex items-center justify-center font-bold text-foreground shrink-0 border border-border">
                            #{i + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {tenant._count.contentEntries} entries &middot; {tenant._count.media} files
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-muted-foreground">Usage</p>
                          <p className="text-sm font-bold text-foreground mt-1">{(tenant._count.contentEntries + tenant._count.media).toLocaleString()}</p>
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
            <Card className="lg:col-span-2 rounded-none border border-border shadow-none">
              <CardHeader className="border-b border-border px-6 py-4 bg-card">
                <CardTitle className="text-base font-bold">System Management</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-zinc-200 bg-card">
                  {[
                    { label: "Content Schema", href: "/admin/content-types", icon: Database },
                    { label: "Single Types",  href: "/admin/single-types",  icon: FileText },
                    { label: "Components",    href: "/admin/components",     icon: Puzzle },
                    { label: "Tenants List",   href: "/admin/tenants",            icon: Building2 },
                    { label: "User Directory", href: "/admin/users",              icon: Users },
                    { label: "RBAC Security",  href: "/admin/rbac",              icon: Shield },
                    { label: "Monitoring",       href: "/admin/monitoring",         icon: Activity },
                    { label: "Billing Admin",    href: "/admin/billing",           icon: CreditCard },
                  ].map((action, index) => (
                    <Link key={action.label} href={action.href} className="col-span-1 p-6 flex flex-col items-center justify-center gap-3 hover:bg-background transition-colors">
                      <action.icon className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">{action.label}</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <Card className="rounded-none border border-border shadow-none bg-card">
              <CardHeader className="border-b border-border px-6 py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-orange-500" />
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">System Status</CardTitle>
                    <CardDescription className="text-xs">All Systems Operational</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {[
                    { name: "Database Cluster", status: "Healthy" },
                    { name: "Object Storage (R2)", status: "Active" },
                    { name: "WebSocket Gateway", status: "Connected" },
                    { name: "API Rate Limiter", status: "Enabled" },
                    { name: "Webhook Dispatcher", status: "Running" },
                  ].map((service) => (
                    <div key={service.name} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-medium">{service.name}</span>
                      <span className="flex items-center gap-2 font-semibold text-foreground">
                        <span className="h-2 w-2 bg-orange-500" />
                        {service.status}
                      </span>
                    </div>
                  ))}
                </div>
                <Separator className="my-6" />
                <p className="text-xs text-muted-foreground text-center">
                  SaCMS v0.2.0 &middot; Production Infrastructure
                </p>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  )
}
