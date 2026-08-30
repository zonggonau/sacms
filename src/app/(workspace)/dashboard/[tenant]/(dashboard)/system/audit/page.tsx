"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Loader2, ClipboardList, Search, RefreshCw,
  User, Eye, ChevronLeft, ChevronRight, Terminal, Copy, Check,
  ShieldCheck, Monitor, MapPin, Activity
} from "lucide-react"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { JsonViewer } from "@/components/ui/json-viewer"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { IpBadge } from "@/components/dashboard/ip-badge"

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

  const [liveTenants, setLiveTenants] = useState<any[]>([])
  const [loadingTenants, setLoadingTenants] = useState(true)

  useEffect(() => {
    async function fetchLiveTenants() {
      try {
        setLoadingTenants(true)
        const res = await fetch("/api/tenants")
        if (res.ok) {
          const data = await res.json()
          setLiveTenants(data.tenants || [])
        }
      } catch (error) {
        console.error("Failed to fetch live tenants in audit logs:", error)
      } finally {
        setLoadingTenants(false)
      }
    }
    if (status === "authenticated" && session?.user) {
      fetchLiveTenants()
    } else if (status === "unauthenticated") {
      setLoadingTenants(false)
    }
  }, [session, status])

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
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Gagal memuat log aktivitas" })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  };

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
    if (act.includes("CREATE")) return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold text-[9px] px-2 py-0.5 rounded-full">{act}</Badge>
    if (act.includes("UPDATE")) return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-bold text-[9px] px-2 py-0.5 rounded-full">{act}</Badge>
    if (act.includes("DELETE")) return <Badge variant="outline" className="border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[9px] px-2 py-0.5 rounded-full">{act}</Badge>
    if (act.includes("PUBLISH")) return <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-[9px] px-2 py-0.5 rounded-full">{act}</Badge>
    return <Badge variant="outline" className="font-bold text-[9px] px-2 py-0.5 rounded-full border-border/80 text-muted-foreground">{act}</Badge>
  }

  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    const q = searchQuery.toLowerCase()
    return logs.filter(l => 
      l.action.toLowerCase().includes(q) || 
      l.entity.toLowerCase().includes(q) ||
      (l.user?.name && l.user.name.toLowerCase().includes(q)) ||
      (l.user?.email && l.user.email.toLowerCase().includes(q))
    )
  }, [logs, searchQuery])

  if (status === "loading" || loadingTenants || (loading && !refreshing)) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <div className="flex-1 bg-background text-foreground flex flex-col w-full">
          <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
              <div className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-7 w-56 rounded-lg" />
                  <Skeleton className="h-3.5 w-80 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-4 space-y-2">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-6 w-12 rounded-lg" />
                </Card>
              ))}
            </div>

            <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
              <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <Skeleton className="h-4 w-48 max-w-full rounded-md" />
                        <Skeleton className="h-3 w-64 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-28 rounded-md shrink-0" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Audit Log & Aktivitas</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Pemantauan kepatuhan dan jejak audit perubahan pada workspace.</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => fetchLogs(page)} 
              disabled={refreshing} 
              className="bg-card font-bold text-xs h-9 rounded-xl border-border/80 shadow-xs hover:bg-muted shrink-0"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin text-primary")} />
              Muat Ulang
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="border border-border/80 shadow-xs rounded-2xl bg-card lg:col-span-1 overflow-hidden h-fit">
              <CardHeader className="p-4 pb-2 border-b border-border/60">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filter Log</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Cari Aksi / Resource</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground opacity-50" />
                    <Input
                      placeholder="Cari log..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 bg-background border-border/80 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Kategori Aksi</Label>
                  <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-xl text-xs font-medium">
                      <SelectValue placeholder="Semua Aktivitas" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      <SelectItem value="all" className="text-xs font-medium rounded-lg">Semua Aktivitas</SelectItem>
                      <SelectItem value="content.created" className="text-xs font-medium rounded-lg">Pembuatan Konten</SelectItem>
                      <SelectItem value="content.updated" className="text-xs font-medium rounded-lg">Pembaruan Konten</SelectItem>
                      <SelectItem value="content.deleted" className="text-xs font-medium rounded-lg">Penghapusan Konten</SelectItem>
                      <SelectItem value="content.published" className="text-xs font-medium rounded-lg">Publikasi Konten</SelectItem>
                      <SelectItem value="media.uploaded" className="text-xs font-medium rounded-lg">Aset Media</SelectItem>
                      <SelectItem value="webhook.created" className="text-xs font-medium rounded-lg">Perubahan Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden bg-card lg:col-span-3">
              <Table>
                <TableHeader className="bg-muted/30 border-b border-border/60">
                  <TableRow>
                    <TableHead className="font-bold text-xs pl-6 text-muted-foreground">Waktu</TableHead>
                    <TableHead className="font-bold text-xs text-muted-foreground">Pelaku (User)</TableHead>
                    <TableHead className="font-bold text-xs text-muted-foreground">Aksi Event</TableHead>
                    <TableHead className="font-bold text-xs text-muted-foreground">Resource</TableHead>
                    <TableHead className="text-right font-bold text-xs pr-6 text-muted-foreground">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                        <p className="font-bold text-xs text-foreground">Tidak ada riwayat aktivitas</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Catatan log akan muncul otomatis seiring perubahan pada workspace.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/40 border-b border-border/60 transition-colors group">
                        <TableCell className="pl-6 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              {log.user?.image ? (
                                <img src={log.user.image} alt={log.user.name || ""} className="w-full h-full object-cover" />
                              ) : (
                                <User className="h-3.5 w-3.5 text-primary" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate text-foreground">
                                {log.user?.name || "Sistem Otomatis"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono truncate">
                                {log.user?.email || "system@internal"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-foreground">{log.entity}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{log.entityId ? log.entityId.substring(0, 12) : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-3">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all" 
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              
              {totalPages > 1 && (
                <div className="p-3.5 bg-muted/20 border-t border-border/60 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Halaman {page} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1 || refreshing} className="h-8 rounded-xl border-border/80 text-xs font-bold bg-card hover:bg-muted shadow-xs">
                      <ChevronLeft className="h-3.5 w-3.5 mr-1 text-primary" /> Sebelumnya
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages || refreshing} className="h-8 rounded-xl border-border/80 text-xs font-bold bg-card hover:bg-muted shadow-xs">
                      Selanjutnya <ChevronRight className="h-3.5 w-3.5 ml-1 text-primary" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="p-4 bg-muted/30 border border-border/80 rounded-2xl flex gap-3 text-card-foreground shadow-xs">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-foreground">Transparansi & Keamanan Audit</p>
              <p className="text-[11px] leading-relaxed text-muted-foreground mt-0.5">
                Audit Trail SaCMS mencatat bukti mutasi data secara permanen di tingkat database workspace untuk akuntabilitas tim.
              </p>
            </div>
          </div>
        </div>

        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[620px] rounded-2xl border border-border/80 bg-card text-foreground shadow-xl p-0 overflow-hidden">
            <div className="bg-muted/20 p-5 border-b border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Terminal className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">{selectedLog?.action.replace('.', ' ')}</DialogTitle>
                  <DialogDescription className="text-muted-foreground text-xs">Detail Log Aktivitas</DialogDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" className="h-8 rounded-xl bg-card hover:bg-muted text-xs font-bold shadow-xs border-border/80" onClick={handleCopyJson}>
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copied ? "Disalin" : "Salin JSON"}
              </Button>
            </div>
            
            <div className="p-5 space-y-5 bg-card text-foreground">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Aktor</span>
                  </div>
                  <p className="text-xs font-bold truncate text-foreground">{selectedLog?.user?.name || "Sistem"}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">IP Asal</span>
                  </div>
                  <div className="mt-0.5">
                    <IpBadge ipAddress={selectedLog?.ipAddress} showCountryName={true} showCopy={true} />
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-muted/20 border border-border/60 space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Monitor className="h-3.5 w-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Platform</span>
                  </div>
                  <p className="text-[11px] font-medium text-muted-foreground truncate" title={selectedLog?.userAgent || ""}>
                    {selectedLog?.userAgent ? (selectedLog.userAgent.includes("Windows") ? "Windows Desktop" : "Browser/Client") : "Internal SDK"}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Payload Data (JSON)</Label>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-2 text-xs">
                  <JsonViewer data={typeof selectedLog?.data === 'string' ? JSON.parse(selectedLog?.data) : selectedLog?.data} />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
