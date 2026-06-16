"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2, Activity, Cpu, HardDrive, Globe, RefreshCw, 
  AlertTriangle, Search, Filter, CheckCircle2, Clock, Play, Pause,
  ChevronLeft, ChevronRight
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface SystemMetric {
  type: string
  value: number
  metadata: string | null
  timestamp: string
}

interface ApiRequest {
  id: string
  tenantId: string | null
  endpoint: string
  method: string
  statusCode: number
  duration: number
  apiKeyId: string | null
  createdAt: string
}

export default function AdminMonitoringPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [apiRequests, setApiRequests] = useState<ApiRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")

  // Pagination States
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRequests, setTotalRequests] = useState(0)

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1) // Reset to page 1 on new search
    }, 500)
    return () => clearTimeout(handler)
  }, [searchQuery])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [statusFilter, methodFilter])

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [metricsRes, requestsRes] = await Promise.all([
        fetch("/api/admin/monitoring/metrics"),
        fetch(`/api/admin/monitoring/requests?page=${page}&limit=10&search=${encodeURIComponent(debouncedSearch)}&status=${statusFilter}&method=${methodFilter}`),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data.metrics || [])
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setApiRequests(data.requests || [])
        setTotalPages(data.totalPages || 1)
        setTotalRequests(data.total || 0)
        setPage(data.page || 1)
      }
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [page, debouncedSearch, statusFilter, methodFilter])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchData()
    }
  }, [session, fetchData])

  // Auto-refresh logic
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchData()
      }, 30000) // 30 seconds
    }
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  const getStatusBadge = (code: number) => {
    if (code < 300) return <Badge className="rounded-none bg-transparent text-emerald-600 border border-emerald-600 shadow-none font-mono text-[10px] px-1.5 py-0.5">{code}</Badge>
    if (code < 400) return <Badge className="rounded-none bg-transparent text-blue-600 border border-blue-600 shadow-none font-mono text-[10px] px-1.5 py-0.5">{code}</Badge>
    if (code < 500) return <Badge className="rounded-none bg-transparent text-orange-600 border border-orange-600 shadow-none font-mono text-[10px] px-1.5 py-0.5">{code}</Badge>
    return <Badge className="rounded-none bg-transparent text-red-600 border border-red-600 shadow-none font-mono text-[10px] px-1.5 py-0.5" variant="outline">{code}</Badge>
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
        <div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">System Monitoring</h1>
              <p className="text-xs text-muted-foreground font-mono">Real-time infrastructure performance and API traffic analytics.</p>
            </div>
            
            <div className="flex items-center gap-4 bg-card p-2 px-4 rounded-none border border-border shadow-none">
              <div className="flex items-center gap-2 border-r border-border pr-4 mr-2">
                <Switch 
                  id="auto-refresh" 
                  checked={autoRefresh} 
                  onCheckedChange={setAutoRefresh} 
                  className="data-[state=checked]:bg-orange-500"
                />
                <Label htmlFor="auto-refresh" className="text-xs font-black tracking-wider flex items-center gap-1.5 cursor-pointer">
                  {autoRefresh ? (
                    <>
                      <span className="h-2 w-2 bg-orange-500 animate-pulse" />
                      AUTO-REFRESH
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 bg-muted-foreground" />
                      PAUSED
                    </>
                  )}
                </Label>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchData} 
                disabled={refreshing} 
                className="h-8 rounded-none border-border font-black text-xs hover:bg-muted/20"
              >
                <RefreshCw className={`h-3 w-3 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "REFRESHING..." : "REFRESH NOW"}
              </Button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "CPU Usage", value: `${metrics.find(m => m.type === 'cpu')?.value || 0}%`, icon: Cpu, color: "text-orange-500" },
              { label: "Memory RAM", value: `${metrics.find(m => m.type === 'memory')?.value || 0}%`, icon: HardDrive, color: "text-orange-500" },
              { label: "Requests/Min", value: metrics.find(m => m.type === 'requests')?.value || 0, icon: Globe, color: "text-orange-500" },
              { label: "Errors (1h)", value: metrics.find(m => m.type === 'errors')?.value || 0, icon: AlertTriangle, color: "text-orange-500" },
            ].map((m) => (
              <Card key={m.label} className="border border-border rounded-none shadow-none bg-card">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-none border border-border bg-muted/20 flex items-center justify-center">
                    <m.icon className={`h-5 w-5 ${m.color}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{m.label}</p>
                    <p className="text-2xl font-black tracking-tight">{m.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Traffic Area */}
          <Card className="border border-border rounded-none shadow-none bg-card overflow-hidden">
            <CardHeader className="bg-card border-b border-border p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-orange-500">API Traffic Logs</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">Live monitoring of endpoint consumption</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Filter endpoint or tenant..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-[200px] text-xs bg-muted/20 border border-border rounded-none focus-visible:ring-0 focus-visible:border-orange-500 font-mono"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/20 border border-border rounded-none focus:ring-0 focus:border-orange-500 font-mono">
                      <Filter className="h-3 w-3 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border border-border bg-card">
                      <SelectItem value="all" className="rounded-none focus:bg-orange-500 focus:text-white">All Status</SelectItem>
                      <SelectItem value="success" className="rounded-none focus:bg-orange-500 focus:text-white">Success (2xx)</SelectItem>
                      <SelectItem value="client_error" className="rounded-none focus:bg-orange-500 focus:text-white">Client Error (4xx)</SelectItem>
                      <SelectItem value="server_error" className="rounded-none focus:bg-orange-500 focus:text-white">Server Error (5xx)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="h-8 w-[110px] text-xs bg-muted/20 border border-border rounded-none focus:ring-0 focus:border-orange-500 font-mono">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border border-border bg-card">
                      <SelectItem value="all" className="rounded-none focus:bg-orange-500 focus:text-white">All Methods</SelectItem>
                      <SelectItem value="GET" className="rounded-none focus:bg-orange-500 focus:text-white">GET</SelectItem>
                      <SelectItem value="POST" className="rounded-none focus:bg-orange-500 focus:text-white">POST</SelectItem>
                      <SelectItem value="PATCH" className="rounded-none focus:bg-orange-500 focus:text-white">PATCH</SelectItem>
                      <SelectItem value="DELETE" className="rounded-none focus:bg-orange-500 focus:text-white">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/10 border-b border-border">
                    <tr>
                      <th className="px-6 py-3">Method & Status</th>
                      <th className="px-6 py-3">Endpoint</th>
                      <th className="px-6 py-3">Tenant ID</th>
                      <th className="px-6 py-3">Latency</th>
                      <th className="px-6 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {apiRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-mono text-xs">
                          {searchQuery ? "No requests match your filters" : "Waiting for API traffic..."}
                        </td>
                      </tr>
                    ) : (
                      apiRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs w-10 text-foreground">{req.method}</span>
                              {getStatusBadge(req.statusCode)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-[11px] bg-muted/40 border border-border px-2 py-1 rounded-none font-mono text-muted-foreground max-w-[320px] truncate block">
                              {req.endpoint}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono font-medium text-foreground">
                              {req.tenantId ? (
                                <span className="border border-border px-1.5 py-0.5 bg-muted/20 rounded-none text-[10px]">{req.tenantId}</span>
                              ) : (
                                <span className="text-orange-500 font-black text-[10px] tracking-widest uppercase bg-orange-500/10 px-1.5 py-0.5 border border-orange-500/20">global</span>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 font-mono text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className={`font-bold ${req.duration > 500 ? 'text-orange-500' : 'text-foreground'}`}>
                                {req.duration}ms
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-[10px] text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-muted/5">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Showing page {page} of {totalPages || 1} ({totalRequests} Total)
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-none border-border hover:bg-background"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || totalPages === 0}
                    className="rounded-none border-border hover:bg-background"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Health Checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-border rounded-none shadow-none bg-card">
              <CardHeader className="p-5 border-b border-border">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Component Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-5">
                {[
                  { name: "API Gateway", status: "HEALTHY", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Database Cluster", status: "HEALTHY", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Payment Service", status: "CONNECTED", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Webhook Worker", status: "RUNNING", icon: CheckCircle2, color: "text-emerald-500" },
                ].map(s => (
                  <div key={s.name} className="flex items-center justify-between p-3 rounded-none border border-border bg-muted/10 font-mono">
                    <span className="text-xs font-bold text-foreground">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black tracking-wider text-emerald-600 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">{s.status}</span>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border border-border rounded-none shadow-none bg-card flex flex-col justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-none border border-border bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-orange-500 animate-pulse" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Intelligent Infrastructure</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-2 font-mono">
                All metrics are aggregated from distributed clusters. Use these logs to debug performance bottlenecks or detect unauthorized access attempts.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
