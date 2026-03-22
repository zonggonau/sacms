"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Loader2, ClipboardList, Search, RefreshCw, Filter,
  User, Eye, ChevronLeft, ChevronRight, Terminal, Copy, Check,
  ShieldCheck, Info, Monitor, MapPin, Activity
} from "lucide-react"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { JsonViewer } from "@/components/ui/json-viewer"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface AuditLog {
  id: string
  tenantId: string | null
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  data: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user?: {
    name: string | null
    email: string | null
    image: string | null
  }
}

export default function TenantAuditLogsPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copied, setCopied] = useState(false)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchLogs = async (p: number = 1) => {
    if (!tenantSlug || !session?.user) return
    setRefreshing(true)
    try {
      const queryParams = new URLSearchParams({ 
        page: String(p), 
        limit: "20" 
      })
      if (actionFilter !== "all") queryParams.set("action", actionFilter)

      const res = await fetch(`/api/tenant/${tenantSlug}/audit-logs?${queryParams}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalPages(data.meta?.totalPages || 1)
        setPage(data.meta?.page || 1)
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err)
      toast({ variant: "destructive", title: "Error", description: "Failed to load activity logs" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchLogs(page)
  }, [tenantSlug, session, page, actionFilter])

  const handleCopyJson = () => {
    if (!selectedLog?.data) return
    const jsonStr = typeof selectedLog.data === 'string' 
      ? JSON.stringify(JSON.parse(selectedLog.data), null, 2)
      : JSON.stringify(selectedLog.data, null, 2)
    
    navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase().replace('.', ' ')
    if (act.includes("CREATE")) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-black text-[9px] px-2">{act}</Badge>
    if (act.includes("UPDATE")) return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-black text-[9px] px-2">{act}</Badge>
    if (act.includes("DELETE")) return <Badge variant="destructive" className="border-none font-black text-[9px] px-2">{act}</Badge>
    if (act.includes("PUBLISH")) return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-black text-[9px] px-2">{act}</Badge>
    return <Badge variant="secondary" className="font-black text-[9px] px-2">{act}</Badge>
  }

  if (status === "loading" || loading && !refreshing) {
    return (
      <div className="flex min-h-screen">
        <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-lg">
                <Activity className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Audit Trail</h1>
                <p className="text-muted-foreground text-sm font-medium">Compliance & activity monitoring for your workspace.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => fetchLogs(page)} disabled={refreshing} className="bg-card font-bold h-11 rounded-xl border-zinc-200">
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh Activity
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-sm bg-card lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Search Action</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                    <Input
                      placeholder="Find logs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-10 bg-muted/30 border-none focus-visible:ring-emerald-500/20"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Action Type</Label>
                  <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
                    <SelectTrigger className="h-10 bg-muted/30 border-none font-bold">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-xl">
                      <SelectItem value="all">All Activities</SelectItem>
                      <SelectItem value="content.created">Entry Creation</SelectItem>
                      <SelectItem value="content.updated">Entry Updates</SelectItem>
                      <SelectItem value="content.published">Entry Publications</SelectItem>
                      <SelectItem value="media.uploaded">Media Assets</SelectItem>
                      <SelectItem value="webhook.created">Webhook Changes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm overflow-hidden bg-card lg:col-span-3">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Timestamp</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Team Member</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Event Action</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-widest">Resource</TableHead>
                    <TableHead className="text-right font-bold text-[10px] uppercase tracking-widest pr-6">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-24 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">No activity recorded</p>
                        <p className="text-xs">Logs will appear here as changes are made to the workspace.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/5 transition-colors group">
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                              {log.user?.image ? (
                                <img src={log.user.image} alt={log.user.name || ""} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate text-foreground">
                                {log.user?.name || "System Process"}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {log.user?.email || "automated-action@system"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-primary/70 tracking-tighter">{log.entity}</span>
                            <span className="text-[9px] font-mono text-muted-foreground mt-0.5 opacity-50">{log.entityId ? log.entityId.substring(0, 12) : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full hover:bg-emerald-50 hover:text-emerald-600 opacity-0 group-hover:opacity-100 transition-all" 
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1 || refreshing} className="h-8 rounded-lg font-bold">
                      <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages || refreshing} className="h-8 rounded-lg font-bold">
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex gap-4 text-emerald-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 rounded-full -mr-16 -mt-16" />
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 shadow-sm relative z-10">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="relative z-10">
              <p className="text-sm font-black uppercase tracking-widest">Trust & Transparency</p>
              <p className="text-[11px] leading-relaxed mt-1 font-medium opacity-80 max-w-2xl">
                The SaCMS Audit Trail provides immutable evidence of all activities within your workspace. 
                This ensures accountability across your content team and simplifies regulatory compliance.
              </p>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[650px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
            <div className="bg-zinc-900 p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">{selectedLog?.action.replace('.', ' ')}</DialogTitle>
                  <DialogDescription className="text-zinc-400 text-xs font-medium">Activity Detail Log</DialogDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10" onClick={handleCopyJson}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Copied" : "Copy JSON"}
              </Button>
            </div>
            
            <div className="p-6 space-y-6 bg-card">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-muted/30 border border-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Actor</span>
                  </div>
                  <p className="text-xs font-bold truncate">{selectedLog?.user?.name || "System"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Origin IP</span>
                  </div>
                  <p className="text-xs font-mono font-bold">{selectedLog?.ipAddress || "::1"}</p>
                </div>
                <div className="p-4 rounded-2xl bg-muted/30 border border-muted/50 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Platform</span>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground truncate" title={selectedLog?.userAgent || ""}>
                    {selectedLog?.userAgent ? (selectedLog.userAgent.includes("Windows") ? "Windows Desktop" : "Mobile/Browser") : "Internal SDK"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Mutation Payload</Label>
                <div className="rounded-2xl border bg-zinc-950 p-4 shadow-inner">
                  <JsonViewer data={typeof selectedLog?.data === 'string' ? JSON.parse(selectedLog?.data) : selectedLog?.data} />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
