"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, Search, Filter,
  CheckSquare, Square, Download, MoreHorizontal, ImageIcon, AlertCircle,
  Check, Layers, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { 
  bulkContentAction, 
  deleteEntryAction, 
  updateContentEntryStatusAction 
} from "@/actions/content"

import { allowedUserTransitions, isWorkflowStatus, WorkflowStatus } from "@/lib/content-workflow-rules"
import { ChevronDown } from "lucide-react"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT:     { label: "Draft",      color: "bg-muted text-muted-foreground border-border/80", icon: FileText },
  IN_REVIEW: { label: "In Review",  color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Clock },
  APPROVED:  { label: "Approved",   color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: CheckCircle2 },
  SCHEDULED: { label: "Scheduled",  color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Clock },
  PUBLISHED: { label: "Published",  color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   color: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20", icon: Archive },
  REJECTED:  { label: "Rejected",   color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20", icon: AlertCircle },
}

function stripHtml(html: string) {
  if (!html) return ""
  return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ')
}

export function ContentEntriesManager({ 
  contentType, 
  initialEntries,
  tenantSlug,
  contentTypeSlug,
  isLimitReached = false,
  limit = 0,
  currentCount = 0,
  basePath,
  userRole = "owner",
  customPermissions = null,
}: { 
  contentType: any, 
  initialEntries: any[],
  tenantSlug: string,
  contentTypeSlug: string,
  isLimitReached?: boolean,
  limit?: number,
  currentCount?: number,
  basePath?: string,
  userRole?: string,
  customPermissions?: string[] | null,
}) {
  const router = useRouter()
  const navBasePath = basePath || `/dashboard/${tenantSlug}/cms`
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED", "APPROVED", "SCHEDULED", "REJECTED"])

  const filteredEntries = useMemo(() => {
    return initialEntries.filter(entry => {
      const data = entry.data || {}
      const title = String(data.judul_berita || data.judul || data.title || data.name || "").toLowerCase()
      const matchesSearch = title.includes(searchQuery.toLowerCase()) || entry.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter.includes(entry.status)
      return matchesSearch && matchesStatus
    })
  }, [initialEntries, searchQuery, statusFilter])

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredEntries.map(e => e.id))
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0) return
    if (action === 'delete' && !confirm(`Hapus permanen ${selectedIds.length} entri yang dipilih?`)) return
    
    try {
      const res = await bulkContentAction(tenantSlug, contentTypeSlug, selectedIds, action)
      if (res.success) {
        toast({ title: "Aksi Massal Berhasil", description: `${selectedIds.length} entri diperbarui.` })
        setSelectedIds([])
      } else {
        toast({ variant: "destructive", title: "Aksi Gagal", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Terjadi kesalahan saat memproses aksi massal." })
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus entri konten ini secara permanen?')) return
    try {
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, entryId)
      if (res.success) {
        toast({ title: "Entri Berhasil Dihapus" })
      } else {
        toast({ variant: "destructive", title: "Gagal Menghapus", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await updateContentEntryStatusAction(tenantSlug, contentTypeSlug, entryId, newStatus)
      if (res.success) {
        toast({ title: "Status Berhasil Diperbarui" })
      } else {
        toast({ variant: "destructive", title: "Gagal Mengubah Status", description: "error" in res ? (res as any).error : "Gagal mengubah status" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const canCreateEntry = userRole !== "subscriber" && userRole !== "viewer"
  const canDeleteEntry = userRole !== "subscriber" && userRole !== "viewer"

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-xl border-border/80 hover:bg-muted shrink-0" 
                onClick={() => router.push(navBasePath)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                    {contentType?.name || "Entri Konten"}
                  </h1>
                  <Badge variant="outline" className="text-[10px] font-mono rounded-md font-semibold">
                    {filteredEntries.length} Entri
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Kelola dan publikasikan entri data untuk model koleksi <code className="font-mono font-bold text-foreground">{contentTypeSlug}</code>.
                </p>
              </div>
            </div>

            {canCreateEntry && (
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl h-9 px-4 text-xs shadow-xs shrink-0" 
                onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Buat Entri Baru
              </Button>
            )}
          </div>

          {/* Limit Reached Warning Banner */}
          {isLimitReached && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs text-red-600 dark:text-red-400 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <div className="font-medium">
                Workspace Anda telah mencapai batas kuota entri konten ({limit} entri). Hapus entri lama atau tingkatkan paket langganan untuk menambah entri baru.
              </div>
            </div>
          )}

          {/* Search, Filter & Bulk Actions Bar */}
          <Card className="rounded-2xl border-border/80 shadow-xs bg-card p-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              
              {/* Search & Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input 
                    placeholder={`Cari data ${contentType?.name}...`} 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-muted/30 border-border/80 rounded-xl text-xs"
                  />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 rounded-xl border-border/80 text-xs font-bold shrink-0">
                      <Filter className="h-3.5 w-3.5 mr-1.5" /> Filter Status
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-xl border-border bg-card shadow-xs">
                    {Object.keys(STATUS_CONFIG).map(s => (
                      <DropdownMenuCheckboxItem
                        key={s}
                        checked={statusFilter.includes(s)}
                        onCheckedChange={(checked) => {
                          setStatusFilter(prev => checked ? [...prev, s] : prev.filter(i => i !== s))
                        }}
                        className="text-xs font-medium rounded-lg"
                      >
                        {STATUS_CONFIG[s].label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bulk Actions (When Items Selected) */}
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5 p-1 px-2.5 bg-muted/60 rounded-xl border border-border/80 animate-in fade-in">
                  <span className="text-[11px] font-bold text-foreground mr-1.5">
                    {selectedIds.length} Terpilih
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 text-xs font-bold rounded-lg" 
                    onClick={() => handleBulkAction('publish')}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" /> Publish
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 text-xs font-bold rounded-lg" 
                    onClick={() => handleBulkAction('unpublish')}
                  >
                    <FileText className="h-3 w-3 mr-1 text-muted-foreground" /> Draft
                  </Button>
                  <Separator orientation="vertical" className="h-4 bg-border" />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-7 text-xs font-bold text-red-600 hover:bg-red-500/10 rounded-lg" 
                    onClick={() => handleBulkAction('delete')}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Hapus
                  </Button>
                </div>
              )}

            </div>
          </Card>

          {/* Content Entries Table */}
          <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/20 border-b border-border/60">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px] pl-5">
                      <button onClick={handleToggleSelectAll} className="focus:outline-none cursor-pointer flex items-center justify-center">
                        {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                    </TableHead>
                    {contentType?.fields.slice(0, 4).map((field: any) => (
                      <TableHead key={field.id} className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">
                        {field.name}
                      </TableHead>
                    ))}
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground text-center py-3">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Terakhir Diubah</TableHead>
                    <TableHead className="text-right pr-5 font-bold text-[10px] uppercase tracking-wider text-muted-foreground py-3">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(contentType?.fields.slice(0, 4).length || 0) + 4} className="text-center py-20 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-2xl bg-muted/40 flex items-center justify-center border border-border/60">
                            <Search className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="font-bold text-xs text-foreground mt-1">Tidak ada entri data yang cocok</p>
                          <p className="text-[11px] text-muted-foreground">Coba ubah kata kunci pencarian atau filter status Anda.</p>
                          <Button 
                            variant="link" 
                            size="sm" 
                            className="text-primary text-xs font-bold mt-1" 
                            onClick={() => { setSearchQuery(""); setStatusFilter(Object.keys(STATUS_CONFIG)) }}
                          >
                            Reset Filter Pencarian
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => {
                      const data = entry.data || {}
                      const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                      const StatusIcon = statusCfg.icon
                      
                      return (
                        <TableRow 
                          key={entry.id} 
                          className={cn(
                            "group hover:bg-muted/20 transition-colors border-b border-border/60 last:border-b-0",
                            selectedIds.includes(entry.id) && "bg-muted/30"
                          )}
                        >
                          <TableCell className="pl-5">
                            <button onClick={() => handleToggleSelect(entry.id)} className="focus:outline-none cursor-pointer flex items-center justify-center">
                              {selectedIds.includes(entry.id) ? (
                                <CheckSquare className="h-4 w-4 text-primary" />
                              ) : (
                                <Square className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100" />
                              )}
                            </button>
                          </TableCell>
                          
                          {contentType?.fields.slice(0, 4).map((field: any) => {
                            const val = data[field.slug]
                            const isMedia = ['media', 'image', 'file', 'mediaMultiple', 'gallery', 'picture'].includes(field.type.toLowerCase())
                            const isRichText = ['richtext', 'textarea', 'markdown', 'longtext'].includes(field.type.toLowerCase())
                            
                            return (
                              <TableCell key={field.id} className="py-3 text-xs">
                                {isMedia ? (
                                  <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden border border-border/80">
                                    {val ? (
                                      <img 
                                        src={Array.isArray(val) ? val[0] : String(val)} 
                                        alt="" 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).src = "";
                                          (e.target as HTMLImageElement).className = "hidden";
                                        }}
                                      />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-semibold text-foreground truncate max-w-[240px]">
                                      {val ? (isRichText ? stripHtml(String(val)) : String(val)) : "-"}
                                    </span>
                                    {field.slug === contentType.fields[0]?.slug && (
                                      <span className="text-[10px] font-mono text-muted-foreground">
                                        ID: {entry.id.substring(0, 10)}...
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                            )
                          })}

                          {/* Status Badge with Quick Workflow Switcher */}
                          <TableCell className="text-center py-3">
                            {(() => {
                              const nextStatuses = isWorkflowStatus(entry.status) 
                                ? allowedUserTransitions(entry.status as WorkflowStatus, userRole, customPermissions)
                                : []

                              if (nextStatuses.length === 0) {
                                return (
                                  <Badge variant="outline" className={cn("text-[10px] font-bold px-2.5 py-0.5 rounded-full border shadow-none", statusCfg.color)}>
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusCfg.label}
                                  </Badge>
                                )
                              }

                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold border rounded-full transition-all cursor-pointer hover:opacity-80 shadow-none", statusCfg.color)}>
                                      <StatusIcon className="h-3 w-3" />
                                      {statusCfg.label}
                                      <ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-60" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="w-44 rounded-xl border-border bg-card shadow-xs">
                                    <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Ubah Status Ke</DropdownMenuLabel>
                                    {nextStatuses.map((st) => {
                                      const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.DRAFT
                                      const Icon = cfg.icon
                                      return (
                                        <DropdownMenuItem 
                                          key={st} 
                                          onClick={() => handleStatusChange(entry.id, st)} 
                                          className="text-xs font-bold py-1.5 rounded-lg cursor-pointer"
                                        >
                                          <Icon className="mr-2 h-3.5 w-3.5" />
                                          {cfg.label}
                                        </DropdownMenuItem>
                                      )
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )
                            })()}
                          </TableCell>

                          {/* Timestamp */}
                          <TableCell className="py-3">
                            <div className="flex flex-col text-xs">
                              <span className="font-semibold text-foreground">{new Date(entry.updatedAt).toLocaleDateString()}</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(entry.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right pr-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground"
                                onClick={() => router.push(`${navBasePath}/content/${contentTypeSlug}/edit/${entry.id}`)}
                                title="Edit Entri"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground">
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 rounded-xl border-border bg-card shadow-xs">
                                  <DropdownMenuItem 
                                    className="text-xs font-medium rounded-lg cursor-pointer"
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(entry.data, null, 2))
                                      toast({ title: "JSON Disalin ke Clipboard" })
                                    }}
                                  >
                                    <Download className="mr-2 h-3.5 w-3.5" /> Salin JSON
                                  </DropdownMenuItem>
                                  
                                  {canDeleteEntry && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-red-600 focus:text-red-700 font-bold text-xs rounded-lg hover:bg-red-500/10 cursor-pointer" 
                                        onClick={() => handleDeleteEntry(entry.id)}
                                      >
                                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Entri
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
