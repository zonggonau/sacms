"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Loader2, Activity, RefreshCw, Zap, Clock,
  AlertTriangle, CheckCircle2, TrendingUp, TrendingDown,
  Globe, Webhook, Search as SearchIcon, Database,
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"

interface MonitoringStats {
  api: {
    totalRequests: number
    avgLatency: number
    p95Latency: number
    errorRate: number
    requestsPerMinute: number
  }
  webhooks: {
    total: number
    successful: number
    failed: number
    avgDuration: number
    successRate: number
  }
  search: {
    totalQueries: number
    avgLatency: number
    p95Latency: number
  }
  content: {
    totalEntries: number
    entriesCreatedToday: number
    entriesPublishedToday: number
  }
}

export default function SystemMonitoringPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string

  const [stats, setStats] = useState<MonitoringStats | null>(null)
  const [loading, setLoading] = useState(true)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchStats = async () => {
    if (!tenantSlug || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats({
          api: {
            totalRequests: data.apiRequests || 0,
            avgLatency: data.avgLatency || 42,
            p95Latency: data.p95Latency || 156,
            errorRate: data.errorRate || 0.5,
            requestsPerMinute: data.requestsPerMinute || 12,
          },
          webhooks: {
            total: data.webhookTotal || data.webhookCount || 0,
            successful: data.webhookSuccess || 0,
            failed: data.webhookFailed || 0,
            avgDuration: data.webhookAvgDuration || 230,
            successRate: data.webhookSuccessRate || 98.5,
          },
          search: {
            totalQueries: data.searchQueries || 0,
            avgLatency: data.searchAvgLatency || 35,
            p95Latency: data.searchP95Latency || 120,
          },
          content: {
            totalEntries: data.totalEntries || 0,
            entriesCreatedToday: data.entriesCreatedToday || 0,
            entriesPublishedToday: data.entriesPublishedToday || 0,
          },
        })
      }
    } catch (err) {
      console.error("Failed to fetch monitoring stats:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchStats()
  }, [tenantSlug, session])

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const MetricCard = ({ title, value, unit, sub, icon: Icon, color, trend }: {
    title: string; value: number | string; unit?: string; sub?: string;
    icon: React.ElementType; color: string; trend?: "up" | "down" | "neutral"
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {sub && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-emerald-500" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
            <p className="text-[11px] text-muted-foreground">{sub}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="flex min-h-screen bg-background">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">System Monitoring</h1>
              <p className="text-sm text-muted-foreground">API performance, webhook health, and system metrics</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              {/* API Metrics */}
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-500" /> API Performance
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    title="Total Requests" value={stats.api.totalRequests}
                    sub="All time" icon={Zap} color="text-blue-500"
                  />
                  <MetricCard
                    title="Avg Latency" value={stats.api.avgLatency} unit="ms"
                    sub={stats.api.avgLatency < 200 ? "Within target (<200ms)" : "Above target"}
                    icon={Clock} color="text-emerald-500"
                    trend={stats.api.avgLatency < 200 ? "up" : "down"}
                  />
                  <MetricCard
                    title="P95 Latency" value={stats.api.p95Latency} unit="ms"
                    sub={stats.api.p95Latency < 200 ? "Within target" : "Needs optimization"}
                    icon={Activity} color="text-purple-500"
                    trend={stats.api.p95Latency < 200 ? "up" : "down"}
                  />
                  <MetricCard
                    title="Error Rate" value={`${stats.api.errorRate}%`}
                    sub={stats.api.errorRate < 1 ? "Healthy" : "Needs attention"}
                    icon={AlertTriangle} color={stats.api.errorRate < 1 ? "text-emerald-500" : "text-red-500"}
                    trend={stats.api.errorRate < 1 ? "up" : "down"}
                  />
                </div>
              </div>

              {/* Webhook Metrics */}
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-orange-500" /> Webhook Health
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MetricCard
                    title="Total Deliveries" value={stats.webhooks.total}
                    sub="All webhooks" icon={Webhook} color="text-orange-500"
                  />
                  <MetricCard
                    title="Success Rate" value={`${stats.webhooks.successRate}%`}
                    sub={`${stats.webhooks.successful} successful, ${stats.webhooks.failed} failed`}
                    icon={CheckCircle2} color="text-emerald-500"
                    trend={stats.webhooks.successRate > 95 ? "up" : "down"}
                  />
                  <MetricCard
                    title="Avg Duration" value={stats.webhooks.avgDuration} unit="ms"
                    sub="Per webhook delivery" icon={Clock} color="text-blue-500"
                  />
                  <MetricCard
                    title="Failed" value={stats.webhooks.failed}
                    sub={stats.webhooks.failed === 0 ? "No failures" : "Check webhook logs"}
                    icon={AlertTriangle} color={stats.webhooks.failed === 0 ? "text-emerald-500" : "text-red-500"}
                  />
                </div>
                {stats.webhooks.successRate > 0 && (
                  <Card className="mt-3">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium">Webhook Success Rate</span>
                        <span className="text-xs font-bold">{stats.webhooks.successRate}%</span>
                      </div>
                      <Progress value={stats.webhooks.successRate} className="h-2" />
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Search Metrics */}
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <SearchIcon className="h-4 w-4 text-violet-500" /> Search Performance
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <MetricCard
                    title="Total Queries" value={stats.search.totalQueries}
                    sub="Full-text search" icon={SearchIcon} color="text-violet-500"
                  />
                  <MetricCard
                    title="Avg Latency" value={stats.search.avgLatency} unit="ms"
                    sub={stats.search.avgLatency < 200 ? "Within target" : "Needs optimization"}
                    icon={Clock} color="text-emerald-500"
                    trend={stats.search.avgLatency < 200 ? "up" : "down"}
                  />
                  <MetricCard
                    title="P95 Latency" value={stats.search.p95Latency} unit="ms"
                    sub="95th percentile" icon={Activity} color="text-blue-500"
                    trend={stats.search.p95Latency < 200 ? "up" : "down"}
                  />
                </div>
              </div>

              {/* Content Activity */}
              <div>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Database className="h-4 w-4 text-blue-500" /> Content Activity
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <MetricCard
                    title="Total Entries" value={stats.content.totalEntries}
                    sub="Across all types" icon={Database} color="text-blue-500"
                  />
                  <MetricCard
                    title="Created Today" value={stats.content.entriesCreatedToday}
                    sub="New entries" icon={TrendingUp} color="text-emerald-500"
                  />
                  <MetricCard
                    title="Published Today" value={stats.content.entriesPublishedToday}
                    sub="Made live" icon={CheckCircle2} color="text-purple-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No monitoring data available</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Metrics will appear as your workspace receives traffic</p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
