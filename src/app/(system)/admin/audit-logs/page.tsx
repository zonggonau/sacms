"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { AdminPageSkeleton } from "@/components/admin/admin-page-skeleton"
import { Label } from "@/components/ui/label"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Loader2, ClipboardList, Search, Filter, RefreshCw, 
  Eye, ShieldCheck, ChevronLeft, ChevronRight,
  Terminal, Copy, Check, Info
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { JsonViewer } from "@/components/ui/json-viewer"
import { useToast } from "@/hooks/use-toast"
import { IpBadge } from "@/components/dashboard/ip-badge"
import { cn } from "@/lib/utils"

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
      if (search) url += `&search=${encodeURIComponent(search)}`
      
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
        setTotalPages(data.pagination?.totalPages || 1)
        setPage(data.pagination?.page || 1)
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

  useEffect(() => {
    if (session?.user?.role !== "super_admin") return
    const timer = setTimeout(() => {
      fetchLogs(1)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const handleCopyJson = () => {
    if (!selectedLog?.data) return
    try {
      navigator.clipboard.writeText(JSON.stringify(JSON.parse(selectedLog.data), null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      navigator.clipboard.writeText(selectedLog.data)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getActionBadge = (action: string) => {
    if (action.startsWith("auth.")) return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-none font-bold text-[9px] px-2 py-0.5 rounded-full border">{action.toUpperCase()}</Badge>
    if (action.startsWith("content.")) return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-none font-bold text-[9px] px-2 py-0.5 rounded-full border">{action.toUpperCase()}</Badge>
    if (action.startsWith("tenant.")) return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-none font-bold text-[9px] px-2 py-0.5 rounded-full border">{action.toUpperCase()}</Badge>
    if (action.startsWith("media.")) return <Badge className="bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 shadow-none font-bold text-[9px] px-2 py-0.5 rounded-full border">{action.toUpperCase()}</Badge>
    return <Badge variant="outline" className="text-[9px] font-bold px-2 py-0.5 rounded-full border-border/60 text-muted-foreground">{action.toUpperCase()}</Badge>
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
        <AdminPageSkeleton layout="table" cardsCount={0} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">Audit Log & Jejak Aktivitas</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  Immutable Log
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Rekaman riwayat seluruh aktivitas platform, perubahan data, dan akses administratif.</p>
            </div>
            <Button variant="outline" onClick={() => fetchLogs(page)} disabled={refreshing} className="rounded-xl h-9 text-xs font-bold shadow-xs border-border/80">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} /> Segarkan Log
            </Button>
          </div>

          {/* Filter Bar */}
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardContent className="p-3 flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cari berdasarkan Resource ID, User ID, atau kata kunci..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 rounded-xl text-xs bg-background border-border/80" 
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-[200px] h-9 rounded-xl text-xs bg-background border-border/80">
                  <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Kategori Aksi" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="all" className="text-xs rounded-lg">Semua Aksi</SelectItem>
                  <SelectItem value="auth.login" className="text-xs rounded-lg">Otentikasi / Login</SelectItem>
                  <SelectItem value="content.created" className="text-xs rounded-lg">Pembuatan Konten</SelectItem>
                  <SelectItem value="content.published" className="text-xs rounded-lg">Publikasi Konten</SelectItem>
                  <SelectItem value="tenant.created" className="text-xs rounded-lg">Workspace Baru</SelectItem>
                  <SelectItem value="settings.updated" className="text-xs rounded-lg">Konfigurasi Sistem</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Table Area */}
          <Card className="border border-border/80 shadow-xs overflow-hidden bg-card rounded-2xl">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border/60">
                    <TableHead className="font-bold text-xs uppercase pl-5">Waktu</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Aksi Event</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Aktor</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Sumber Daya</TableHead>
                    <TableHead className="font-bold text-xs uppercase">Sumber IP</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase pr-5">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                        <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="font-bold text-xs text-foreground">Tidak ada catatan audit</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Aktivitas sistem akan muncul di sini secara otomatis.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/20 transition-colors border-b border-border/40 last:border-0 group">
                        <TableCell className="pl-5 py-3">
                          <div className="flex flex-col font-mono text-xs">
                            <span className="font-bold text-foreground">{new Date(log.createdAt).toLocaleDateString('id-ID')}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString('id-ID')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                              {log.userId ? "U" : "S"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold truncate max-w-[100px] text-foreground">
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
                            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">{log.entity}</span>
                            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">{log.entityId ? log.entityId.substring(0, 12) : "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <IpBadge ipAddress={log.ipAddress} showCountryName={false} />
                        </TableCell>
                        <TableCell className="text-right pr-5">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg hover:bg-muted opacity-80 group-hover:opacity-100 transition-opacity" 
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
            {!loading && totalPages > 1 && (
              <div className="p-3 bg-muted/20 border-t border-border/60 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Halaman <span className="font-bold text-foreground">{page}</span> dari <span className="font-bold text-foreground">{totalPages}</span>
                </p>
                <div className="flex gap-1.5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchLogs(page - 1)} 
                    disabled={page <= 1 || refreshing}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Sebelumnya
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => fetchLogs(page + 1)} 
                    disabled={page >= totalPages || refreshing}
                    className="h-8 rounded-lg text-xs font-bold"
                  >
                    Berikutnya <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Security Banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex gap-3.5 text-foreground shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">Log Kepatuhan Tidak Dapat Diubah (Immutable)</p>
              <p className="text-xs leading-relaxed mt-0.5 text-muted-foreground">
                Rekaman audit trail bersifat non-repudiable. Seluruh aktivitas administratif dilindungi dari modifikasi maupun penghapusan untuk menjamin integritas dan keamanan sistem.
              </p>
            </div>
          </div>
        </div>

        {/* JSON Inspector Dialog */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="sm:max-w-[600px] rounded-2xl border-border/80 shadow-xl p-0 overflow-hidden bg-card">
            <DialogHeader className="p-5 bg-muted/20 border-b border-border/60">
              <div className="flex items-center justify-between mr-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-bold uppercase tracking-tight">{selectedLog?.action.replace('.', ' ')}</DialogTitle>
                    <DialogDescription className="text-[11px] font-mono mt-0.5">ID Log: {selectedLog?.id}</DialogDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold border-border/80" onClick={handleCopyJson}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copied ? "Tersalin" : "Salin JSON"}
                </Button>
              </div>
            </DialogHeader>
            <div className="p-5">
              {selectedLog?.data ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Identitas Aktor</p>
                      <p className="text-xs font-mono font-bold text-foreground">{selectedLog.userId || "SYSTEM"}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/20 border border-border/60">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase mb-0.5">Alamat IP & Lokasi</p>
                      <div className="mt-0.5">
                        <IpBadge ipAddress={selectedLog.ipAddress} showCountryName={true} showCopy={true} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Payload Data</Label>
                    <JsonViewer data={JSON.parse(selectedLog.data)} />
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs font-medium">Tidak ada data tambahan untuk rekaman audit ini.</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
