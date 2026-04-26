"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Loader2, Database, FileText, ImageIcon, Users, Plus, PenTool,
  AlertTriangle, Clock, CheckCircle2, Archive, CalendarClock,
  Eye, Key, Globe, XCircle, ArrowRight, Webhook, Activity,
  Zap, Upload, Play, BookOpen, ClipboardList, TrendingUp,
  ChevronRight, ShieldCheck, Sparkles
} from "lucide-react"
import Link from "next/link"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist"

interface AssignedContentType {
  id: string
  name: string
  slug: string
  description?: string
  fields: Array<{ id: string; name: string; type: string }>
  _count?: { entries: number }
}

interface TenantStats {
  tenant?: {
    id: string
    name: string
    slug: string
  }
  contentTypeCount: number
  singleTypeCount: number
  totalEntries: number
  mediaCount: number
  memberCount: number
  apiTokenCount: number
  webhookCount: number
  entries: {
    draft: number
    in_review: number
    approved: number
    scheduled: number
    published: number
    archived: number
  }
  recentEntries: Array<{
    id: string
    status: string
    contentType: string
    contentTypeSlug: string
    updatedAt: string
  }>
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",      dot: "bg-gray-400",    bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",         icon: FileText },
  in_review: { label: "In Review",  dot: "bg-yellow-500",  bg: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Clock },
  approved:  { label: "Approved",   dot: "bg-blue-500",    bg: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",         icon: CheckCircle2 },
  scheduled: { label: "Scheduled",  dot: "bg-purple-500",  bg: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300", icon: CalendarClock },
  published: { label: "Published",  dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: Eye },
  archived:  { label: "Archived",   dot: "bg-orange-500",  bg: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", icon: Archive },
  rejected:  { label: "Rejected",   dot: "bg-red-500",     bg: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",             icon: XCircle },
}

export default function TenantDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantId = params?.tenant as string

  const [contentTypes, setContentTypes] = useState<AssignedContentType[]>([])
  const [stats, setStats] = useState<TenantStats | null>(null)
  const [usage, setUsage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])
  const currentTenant = useMemo(() => {
    // Priority 1: From stats API (most up-to-date)
    if (stats?.tenant) return stats.tenant
    // Priority 2: From session (initial load)
    return tenants.find((t) => t.id === tenantId || t.slug === tenantId)
  }, [tenants, tenantId, stats?.tenant])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchData() {
      if (!tenantId || !session?.user) return
      try {
        const [ctRes, statsRes, usageRes] = await Promise.all([
          fetch(`/api/tenant/${tenantId}/content-types`),
          fetch(`/api/tenant/${tenantId}/stats`),
          fetch(`/api/tenant/${tenantId}/billing/usage`),
        ])
        
        // If API returns 403 or 404, then log it but don't redirect yet so we can debug
        if (ctRes.status === 403 || ctRes.status === 404) {
          console.error(`[Dashboard] API returned ${ctRes.status} for tenant ${tenantId}`);
          // router.push("/dashboard")
          // return
        }

        if (ctRes.ok) {
          const data = await ctRes.json()
          setContentTypes(data.contentTypes || [])
        }
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          setStats({
            ...statsData,
            entries: statsData.entries || {
              draft: 0, in_review: 0, approved: 0, scheduled: 0, published: 0, archived: 0
            },
            recentEntries: statsData.recentEntries || []
          })
        }
        if (usageRes.ok) {
          const usageData = await usageRes.json()
          console.log("[Dashboard] Usage data received:", usageData)
          setUsage(usageData.usage || [])
        } else {
          console.error("[Dashboard] Failed to fetch usage data:", usageRes.status)
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err)
      } finally {
        setLoading(false)
      }
    }
    if (session?.user) fetchData()
  }, [tenantId, session])

  const usageAlerts = useMemo(() => {
    return usage.filter(u => (u.current / u.limit) >= 0.9)
  }, [usage])

  const totalEntries = useMemo(() => {
    if (!stats?.entries) return 0
    return Object.values(stats.entries).reduce((a, b) => (Number(a) || 0) + (Number(b) || 0), 0)
  }, [stats])

  if (status === "loading" || (loading && !stats)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/10">
      <TenantSidebar tenantId={tenantId} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{currentTenant?.name || tenantId}</h1>
              <p className="text-muted-foreground">Welcome back to <strong>{currentTenant?.name || "your"}</strong> content workspace.</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/cms/${tenantId}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200 dark:shadow-none font-bold">
                  <Sparkles className="h-4 w-4 mr-2 fill-current" />
                  CMS Studio
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20">
                    <Plus className="h-4 w-4 mr-2" />
                    New Content
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {contentTypes.length === 0 ? (
                    <DropdownMenuItem disabled>No content types available</DropdownMenuItem>
                  ) : (
                    contentTypes.map(ct => (
                      <DropdownMenuItem key={ct.id} onClick={() => router.push(`/dashboard/${tenantId}/content/${ct.slug}/new`)}>
                        <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                        {ct.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href={`/dashboard/${tenantId}/media`}>
                <Button variant="outline" className="bg-card">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Media
                </Button>
              </Link>
            </div>
          </div>

          <OnboardingChecklist 
            tenantId={tenantId} 
            stats={{
              contentTypeCount: stats?.contentTypeCount ?? 0,
              mediaCount: stats?.mediaCount ?? 0,
              memberCount: stats?.memberCount ?? 1,
              apiTokenCount: stats?.apiTokenCount ?? 0,
              totalEntries: totalEntries
            }} 
          />

          {/* Quota Usage Alerts */}
          {usageAlerts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-4 text-center md:text-left">
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-6 w-6 text-red-600 animate-bounce" />
                </div>
                <div>
                  <p className="text-sm font-black text-red-950 uppercase tracking-tight">Resource Limit Reached</p>
                  <p className="text-xs text-red-800 font-medium">You have used over 90% of your {usageAlerts.map(u => u.label).join(", ")} quota.</p>
                </div>
              </div>
              <Link href={`/dashboard/${tenantId}/subscriptions`}>
                <Button className="bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-xs h-11 px-8 rounded-xl shadow-lg shadow-red-200">
                  Upgrade Plan Now
                </Button>
              </Link>
            </div>
          )}

          {/* Usage Summary Cards (Horizontal) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(usage && usage.length > 0 ? usage : [
              { label: "Content Entries", current: 0, limit: 100, unit: "entries" },
              { label: "Media Storage", current: 0, limit: 104857600, unit: "bytes" },
              { label: "Team Members", current: 1, limit: 3, unit: "users" }
            ]).map((item) => {
              const percentage = Math.min(100, (item.current / item.limit) * 100)
              const formatValue = (val: number, unit: string) => {
                if (unit === "bytes") {
                  const mb = val / (1024 * 1024)
                  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(0)}MB`
                }
                return val.toLocaleString()
              }

              return (
                <Card key={item.label} className="border-none bg-card shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{item.label}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">{formatValue(item.current, item.unit)} / {formatValue(item.limit, item.unit)}</span>
                    </div>
                    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Alert Queue */}
          {stats?.entries && (stats.entries as any).in_review > 0 && (
            <Link href={`/dashboard/${tenantId}/system/audit`}>
              <div className="flex items-center gap-4 p-4 rounded-2xl border border-amber-200 bg-amber-50/50 shadow-sm hover:bg-amber-50 transition-colors group">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900">Review Required</p>
                  <p className="text-xs text-amber-700/80">There are {(stats.entries as any).in_review} entries waiting for your approval.</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Assets", value: stats?.mediaCount ?? 0, icon: ImageIcon, color: "text-blue-500", bg: "bg-blue-50", href: `/dashboard/${tenantId}/media` },
              { label: "Team Size", value: stats?.memberCount ?? 1, icon: Users, color: "text-purple-500", bg: "bg-purple-50", href: `/dashboard/${tenantId}/users` },
              { label: "Active Webhooks", value: stats?.webhookCount ?? 0, icon: Webhook, color: "text-orange-500", bg: "bg-orange-50", href: `/dashboard/${tenantId}/webhooks` },
              { label: "API Keys", value: stats?.apiTokenCount ?? 0, icon: Key, color: "text-emerald-500", bg: "bg-emerald-50", href: `/dashboard/${tenantId}/api-keys` },
            ].map((kpi) => (
              <Link key={kpi.label} href={kpi.href}>
                <Card className="hover:shadow-md transition-all cursor-pointer border-none bg-card group">
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform", kpi.bg)}>
                      <kpi.icon className={cn("h-6 w-6", kpi.color)} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">{kpi.label}</p>
                      <p className="text-2xl font-black leading-none">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Content Collections & Pipeline */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Pipeline Overview */}
              <Card className="border-none shadow-sm bg-card overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold">Content Pipeline</CardTitle>
                      <CardDescription className="text-xs">Workflow status across all {totalEntries} entries</CardDescription>
                    </div>
                    <Badge variant="outline" className="font-bold text-[10px] uppercase">Live Overview</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex h-3 rounded-full overflow-hidden bg-muted mb-6">
                    {stats?.entries && Object.entries(stats.entries).map(([key, count]) => {
                      const numCount = Number(count) || 0
                      if (numCount === 0 || totalEntries === 0) return null
                      const pct = (numCount / totalEntries) * 100
                      const colors: Record<string, string> = {
                        draft: "bg-slate-400", in_review: "bg-amber-400", approved: "bg-blue-400",
                        scheduled: "bg-purple-400", published: "bg-emerald-500", archived: "bg-orange-400",
                      }
                      return <div key={key} className={cn("h-full transition-all", colors[key])} style={{ width: `${pct}%` }} />
                    })}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {stats?.entries && Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                      const count = (stats.entries as any)?.[key] || 0
                      return (
                        <div key={key} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                            <span className="text-xs font-bold text-muted-foreground">{cfg.label}</span>
                          </div>
                          <span className="text-sm font-black">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Collections Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black uppercase tracking-tight text-muted-foreground/70">Content Collections</h2>
                </div>
                {contentTypes.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <PenTool className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
                      <p className="text-sm font-bold text-muted-foreground">No content types assigned yet.</p>
                      <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs mx-auto">Ask your administrator to give this workspace access to content schemas.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {contentTypes.map((ct) => (
                      <Link key={ct.id} href={`/dashboard/${tenantId}/content/${ct.slug}`}>
                        <Card className="hover:shadow-lg transition-all hover:border-primary/50 cursor-pointer group bg-card border-none shadow-sm">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                  <Database className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                  <p className="text-base font-bold leading-none">{ct.name}</p>
                                  <p className="text-xs text-muted-foreground mt-1.5">{ct._count?.entries ?? 0} entries &middot; {ct.fields?.length ?? 0} fields</p>
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="h-5 w-5 text-primary" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Activity & Quick Access */}
            <div className="space-y-6">
              {/* Recent Activity */}
              <Card className="border-none shadow-sm bg-card">
                <CardHeader className="pb-2 border-b">
                  <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Recent Edits</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {(!stats?.recentEntries || stats.recentEntries.length === 0) ? (
                    <div className="py-12 text-center">
                      <Activity className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                      <p className="text-xs text-muted-foreground italic">No recent activity</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {stats.recentEntries.map((entry) => {
                        const cfg = STATUS_CONFIG[entry.status.toLowerCase()] || STATUS_CONFIG.draft
                        return (
                          <Link key={entry.id} href={`/dashboard/${tenantId}/content/${entry.contentTypeSlug}`}>
                            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate text-foreground">{entry.contentType}</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(entry.updatedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                                  </span>
                                </div>
                              </div>
                              <Badge className={cn("text-[9px] font-black px-1.5 py-0", cfg.bg)}>
                                {cfg.label.toUpperCase()}
                              </Badge>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Developer Resources */}
              <Card className="bg-primary/5 border-primary/10 border shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-bold uppercase text-primary tracking-widest">Developer Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-2">
                  <Link href={`/dashboard/${tenantId}/developer/api`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-primary/10 hover:border-primary/30 transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold">API Explorer</p>
                        <p className="text-[10px] text-muted-foreground">Test your endpoints</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                  <Link href={`/dashboard/${tenantId}/developer/sdk`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-primary/10 hover:border-primary/30 transition-all group">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold">Client SDK</p>
                        <p className="text-[10px] text-muted-foreground">Library & Guide</p>
                      </div>
                      <ArrowRight className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                </CardContent>
              </Card>

              {/* Platform Info */}
              <div className="px-2">
                <div className="p-4 rounded-2xl bg-muted/30 border border-muted flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Workspace Security</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      All content changes are tracked in the audit trail. Sensitive API keys should be rotated every 90 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
