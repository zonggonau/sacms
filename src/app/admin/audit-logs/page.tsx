"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Loader2, ClipboardList, Search, Filter, RefreshCw, Calendar, 
  User, Building2, Eye, ShieldCheck, ChevronLeft, ChevronRight,
  Terminal, Copy, Check
} from "lucide-react"
import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { JsonViewer } from "@/components/ui/json-viewer"
import { useToast } from "@/hooks/use-toast"

interface AuditLog {
  id: string
  tenantId: string | null
  userId: string | null
  action: string
  entity: string
  entityId: string | null
  data: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

export default function AdminAuditLogsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  
  // Detail Dialog State
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [copied, setCopied] = useState(false)

  // Filters
  const [actionFilter, setActionFilter] = useState("all")
  const [search, setSearch] = useState("")

  const fetchLogs = async (p: number = 1) => {
    setRefreshing(true)
    try {
      let url = `/api/admin/audit-logs?page=${p}&limit=20`
      if (actionFilter !== "all") url += `&action=${actionFilter}`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalPages(data.pagination.totalPages)
        setPage(data.pagination.page)
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchLogs(1)
  }, [session, actionFilter])

  const handleCopyJson = () => {
    if (!selectedLog?.data) return
    navigator.clipboard.writeText(JSON.stringify(JSON.parse(selectedLog.data), null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getActionBadge = (action: string) => {
    if (action.startsWith("auth.")) return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[10px]">{action.toUpperCase()}</Badge>
    if (action.startsWith("content.")) return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px]">{action.toUpperCase()}</Badge>
    if (action.startsWith("tenant.")) return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[10px]">{action.toUpperCase()}</Badge>
    if (action.startsWith("media.")) return <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 border-none font-bold text-[10px]">{action.toUpperCase()}</Badge>
    return <Badge variant="secondary" className="text-[10px] font-bold">{action.toUpperCase()}</Badge>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Audit Trail</h1>
              <p className="text-muted-foreground">Historical record of all platform activities and administrative changes.</p>
            </div>
            <Button variant="outline" onClick={() => fetchLogs(page)} disabled={refreshing} className="bg-card">
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh Logs
            </Button>
          </div>

          {/* Filter Bar */}
          <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by Resource ID or User..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-10 bg-muted/30 border-none focus-visible:ring-primary" 
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px] h-10 bg-muted/30 border-none">
                  <Filter className="h-3.5 w-3.5 mr-2" />
                  <SelectValue placeholder="Action Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="auth.login">Login Events</SelectItem>
                  <SelectItem value="content.created">Content Creation</SelectItem>
                  <SelectItem value="content.published">Publications</SelectItem>
                  <SelectItem value="tenant.created">New Workspaces</SelectItem>
                  <SelectItem value="settings.updated">System Config</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Table Area */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest pl-6">Timestamp</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Event Action</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Actor</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">Resource</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase tracking-widest">IP Source</TableHead>
                    <TableHead className="text-right font-bold text-[11px] uppercase tracking-widest pr-6">Inspector</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-24 text-muted-foreground">
                        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="font-bold">No audit records found</p>
                        <p className="text-xs">System activity will appear here as it occurs.</p>
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
                            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-black border">
                              {log.userId ? "U" : "S"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold truncate max-w-[100px]">
                                {log.userId ? log.userId.substring(0, 8) : "SYSTEM"}
                              </span>
                              {log.tenantId && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  T:{log.tenantId.substring(0, 6)}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-primary/70 tracking-tighter">{log.entity}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{log.entityId ? log.entityId.substring(0, 12) : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[10px] font-mono bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground border">
                            {log.ipAddress || "::1"}
                          </code>
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
            <div className="p-4 bg-muted/10 border-t flex items-center justify-between">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                Showing Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchLogs(page - 1)} 
                  disabled={page === 1 || refreshing}
                  className="h-8 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchLogs(page + 1)} 
                  disabled={page === totalPages || refreshing}
                  className="h-8 rounded-lg"
                >
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Security Banner */}
          <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-4 text-emerald-800 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest">Immutable Compliance Log</p>
              <p className="text-[11px] leading-relaxed mt-1 font-medium opacity-80 max-w-2xl">
                The audit trail provides a non-repudiable record of all administrative actions. To maintain platform integrity, logs are protected from deletion or modification by any user role.
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
                    <DialogDescription className="text-xs">Detailed data payload for log ID: {selectedLog?.id}</DialogDescription>
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
                    <JsonViewer data={JSON.parse(selectedLog.data)} />
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

import { Info } from "lucide-react"
