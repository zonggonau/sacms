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
  AlertTriangle, Search, Filter, CheckCircle2, Clock, Play, Pause
} from "lucide-react"
import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
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
  const [statusFilter, setStatusFilter] = useState("all")
  const [methodFilter, setMethodFilter] = useState("all")

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [metricsRes, requestsRes] = await Promise.all([
        fetch("/api/admin/monitoring/metrics"),
        fetch("/api/admin/monitoring/requests"),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data.metrics || [])
      }

      if (requestsRes.ok) {
        const data = await requestsRes.json()
        setApiRequests(data.requests || [])
      }
    } catch (error) {
      console.error("Failed to fetch monitoring data:", error)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

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

  const filteredRequests = apiRequests.filter((req) => {
    const matchesSearch = 
      req.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (req.tenantId && req.tenantId.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesStatus = 
      statusFilter === "all" || 
      (statusFilter === "success" && req.statusCode < 400) ||
      (statusFilter === "client_error" && req.statusCode >= 400 && req.statusCode < 500) ||
      (statusFilter === "server_error" && req.statusCode >= 500)
    
    const matchesMethod = methodFilter === "all" || req.method === methodFilter

    return matchesSearch && matchesStatus && matchesMethod
  })

  const getStatusBadge = (code: number) => {
    if (code < 300) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">{code}</Badge>
    if (code < 400) return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">{code}</Badge>
    if (code < 500) return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">{code}</Badge>
    return <Badge variant="destructive">{code}</Badge>
  }

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

  return (
    <div className="flex min-h-screen bg-muted/10">
      <GlobalAdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">System Monitoring</h1>
              <p className="text-muted-foreground">Real-time infrastructure performance and API traffic.</p>
            </div>
            <div className="flex items-center gap-4 bg-card p-2 px-4 rounded-xl border shadow-sm">
              <div className="flex items-center gap-2 border-r pr-4 mr-2">
                <Switch 
                  id="auto-refresh" 
                  checked={autoRefresh} 
                  onCheckedChange={setAutoRefresh} 
                />
                <Label htmlFor="auto-refresh" className="text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                  {autoRefresh ? <><Play className="h-3 w-3 text-emerald-500 fill-emerald-500" /> AUTO</> : <><Pause className="h-3 w-3 text-muted-foreground" /> OFF</>}
                </Label>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchData} disabled={refreshing} className="h-8">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Refreshing..." : "Refresh Now"}
              </Button>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "CPU Usage", value: `${metrics.find(m => m.type === 'cpu')?.value || 0}%`, icon: Cpu, color: "text-blue-500" },
              { label: "Memory RAM", value: `${metrics.find(m => m.type === 'memory')?.value || 0}%`, icon: HardDrive, color: "text-purple-500" },
              { label: "Requests/Min", value: metrics.find(m => m.type === 'requests')?.value || 0, icon: Globe, color: "text-emerald-500" },
              { label: "Errors (1h)", value: metrics.find(m => m.type === 'errors')?.value || 0, icon: AlertTriangle, color: "text-red-500" },
            ].map((m) => (
              <Card key={m.label} className="border-none shadow-sm">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <m.icon className={`h-6 w-6 ${m.color}`} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className="text-2xl font-black">{m.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* API Traffic Area */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-card border-b">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold">API Traffic Logs</CardTitle>
                  <CardDescription className="text-xs">Live monitoring of endpoint consumption</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input 
                      placeholder="Filter endpoint or tenant..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 h-8 w-[200px] text-xs bg-muted/50 border-none"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-[130px] text-xs bg-muted/50 border-none">
                      <Filter className="h-3 w-3 mr-2" />
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success (2xx)</SelectItem>
                      <SelectItem value="client_error">Client Error (4xx)</SelectItem>
                      <SelectItem value="server_error">Server Error (5xx)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="h-8 w-[100px] text-xs bg-muted/50 border-none">
                      <SelectValue placeholder="Method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PATCH">PATCH</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/30 border-b">
                    <tr>
                      <th className="px-6 py-3">Method & Status</th>
                      <th className="px-6 py-3">Endpoint</th>
                      <th className="px-6 py-3">Tenant ID</th>
                      <th className="px-6 py-3">Latency</th>
                      <th className="px-6 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-card">
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                          {searchQuery ? "No requests match your filters" : "Waiting for API traffic..."}
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-muted/5 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs w-10">{req.method}</span>
                              {getStatusBadge(req.statusCode)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground max-w-[300px] truncate block">
                              {req.endpoint}
                            </code>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-muted-foreground">
                              {req.tenantId || <span className="opacity-30 italic">global</span>}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className={`text-xs font-bold ${req.duration > 500 ? 'text-orange-500' : 'text-emerald-600'}`}>
                                {req.duration}ms
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-[10px] text-muted-foreground">
                            {new Date(req.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Bottom Health Checks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-tight">Component Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: "API Gateway", status: "Healthy", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Database Cluster", status: "Healthy", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Payment Service", status: "Connected", icon: CheckCircle2, color: "text-emerald-500" },
                  { name: "Webhook Worker", status: "Running", icon: CheckCircle2, color: "text-emerald-500" },
                ].map(s => (
                  <div key={s.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <span className="text-xs font-medium">{s.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{s.status}</span>
                      <s.icon className={`h-4 w-4 ${s.color}`} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/10 shadow-sm flex flex-col justify-center p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-primary">Intelligent Monitoring</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-2">
                All metrics are aggregated from distributed clusters. Use these logs to debug performance bottlenecks or detect unauthorized access attempts.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
