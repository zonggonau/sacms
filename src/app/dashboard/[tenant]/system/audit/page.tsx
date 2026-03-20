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
  ShieldCheck, Info
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
  
  // Detail Dialog State
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
      // Note: Backend currently doesn't support 'search' in tenant logs, we can add it or filter client-side
      // For now we'll stick to what the API supports

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
    const act = action.toUpperCase()
    if (act.includes("CREATE")) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px]">{act}</Badge>
    if (act.includes("UPDATE")) return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[10px]">{act}</Badge>
    if (act.includes("DELETE")) return <Badge variant="destructive" className="border-none font-bold text-[10px]">{act}</Badge>
    if (act.includes("PUBLISH")) return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[10px]">{act}</Badge>
    return <Badge variant="secondary" className="text-[10px] font-bold">{act}</Badge>
  }

  if (status === "loading" || loading && !refreshing) {
    return (
      <div className="flex min-h-screen">
        <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Audit Trail</h1>
              <p className="text-muted-foreground">Monitor all administrative and content activities in this workspace.</p>
            </div>
            <Button variant="outline" onClick={() => fetchLogs(page)} disabled={refreshing} className="bg-card">
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh Logs
            </Button>
          </div>

          {/* Filters */}
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter by Resource ID or Identity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-muted/30 border-none focus-visible:ring-primary"
                />
              </div>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[200px] h-10 bg-muted/30 border-none">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder="Action Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="content.created">Creation</SelectItem>
                  <SelectItem value="content.updated">Updates</SelectItem>
                  <SelectItem value="content.published">Publications</SelectItem>
                  <SelectItem value="media.uploaded">Media Uploads</SelectItem>
                  <SelectItem value="webhook.created">Webhook Config</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest pl-6">Timestamp</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Event Action</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Actor</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Resource</TableHead>
                    <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest pr-6">Data</TableHead>
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
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black border border-primary/20 text-primary">
                              {log.userId ? "U" : "S"}
                            </div>
                            <span className="text-xs font-bold truncate max-w-[120px]">
                              {log.userId ? log.userId.substring(0, 12) : "SYSTEM"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-primary/70 tracking-tighter">{log.entity}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{log.entityId ? log.entityId.substring(0, 12) : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary opacity-0 group-hover:opacity-100 transition-all" 
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
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(page - 1)} 
                    disabled={page === 1 || refreshing}
                    className="h-8 rounded-lg"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setPage(page + 1)} 
                    disabled={page === totalPages || refreshing}
                    className="h-8 rounded-lg"
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Compliance Info */}
          <div className="p-5 bg-blue-50 border border-blue-100 rounded-2xl flex gap-4 text-blue-800 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest">Workspace Compliance</p>
              <p className="text-[11px] leading-relaxed mt-1 font-medium opacity-80 max-w-2xl">
                The audit trail ensures transparency within your team. All actions including content mutations, media uploads, and configuration changes are tracked and linked to the specific user account responsible.
              </p>
            </div>
          </div>
        </div>

        {/* JSON Inspector Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 bg-muted/30 border-b">
              <div className="flex items-center justify-between mr-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg font-black tracking-tight uppercase">{selectedLog?.action.replace('.', ' ')}</DialogTitle>
                    <DialogDescription className="text-xs">Detailed payload for activity ID: {selectedLog?.id}</DialogDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 rounded-lg" onClick={handleCopyJson}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                  {copied ? "Copied" : "Copy JSON"}
                </Button>
              </div>
            </DialogHeader>
            <div className="p-6">
              {selectedLog?.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-muted/20 border">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Actor Identity</p>
                      <p className="text-xs font-bold">{selectedLog.userId || "SYSTEM"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border">
                      <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Source IP</p>
                      <p className="text-xs font-mono font-bold">{selectedLog.ipAddress || "::1"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Payload Data</Label>
                    <JsonViewer data={typeof selectedLog.data === 'string' ? JSON.parse(selectedLog.data) : selectedLog.data} />
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Info className="h-10 w-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm font-medium">No extended data available for this log entry.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
