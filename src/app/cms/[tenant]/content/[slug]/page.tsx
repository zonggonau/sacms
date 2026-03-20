"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, XCircle, MoreHorizontal,
  ImageIcon, Calendar, Loader2, Send, Search, Filter,
  CheckSquare, Square, Download, ChevronRight, AlertTriangle
} from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { CMSSidebar } from "@/components/cms/cms-sidebar"
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

interface Field {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
}

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: Field[]
}

interface Entry {
  id: string
  data: any
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; icon: any }> = {
  DRAFT:     { label: "Draft",      dot: "bg-gray-400",    bg: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText },
  PUBLISHED: { label: "Published",  dot: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   dot: "bg-orange-500",  bg: "bg-orange-50 text-orange-700 border-orange-200", icon: Archive },
  IN_REVIEW: { label: "In Review",  dot: "bg-blue-500",    bg: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
}

export default function CMSContentTypeEntriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string
  
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  
  // Selection & Search
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED"])

  const fetchData = async () => {
    if (!tenantSlug || !contentTypeSlug) return
    try {
      const [ctRes, entriesRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}`),
        fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries`)
      ])
      
      if (ctRes.ok) setContentType(await ctRes.json())
      if (entriesRes.ok) {
        const data = await entriesRes.json()
        const parsedEntries = (data.entries || []).map((e: any) => {
          let parsedData = e.data
          if (typeof e.data === 'string') {
            try { parsedData = JSON.parse(e.data) } catch (err) { parsedData = {} }
          }
          return { ...e, data: parsedData }
        })
        setEntries(parsedEntries)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load entries" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchData()
  }, [tenantSlug, contentTypeSlug, session])

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const data = entry.data || {}
      const title = String(data.judul_berita || data.judul || data.title || "").toLowerCase()
      const matchesSearch = title.includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter.includes(entry.status)
      return matchesSearch && matchesStatus
    })
  }, [entries, searchQuery, statusFilter])

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
    if (action === 'delete' && !confirm(`Delete ${selectedIds.length} items permanently?`)) return
    
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content/${contentTypeSlug}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action }),
      })
      
      if (res.ok) {
        toast({ title: "Bulk Action Successful", description: `${selectedIds.length} entries updated.` })
        setSelectedIds([])
        fetchData()
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Bulk Action Failed" })
    }
  }

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          publish: newStatus === "PUBLISHED"
        })
      })
      if (res.ok) {
        toast({ title: "Status Updated" })
        fetchData()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  if (loading) {
    return <div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  return (
    <div className="p-6 lg:p-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cms/${tenantSlug}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{contentType?.name}</h1>
            <p className="text-muted-foreground text-sm">Review and publish your content entries</p>
          </div>
        </div>
        <Button 
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 dark:shadow-none h-11 px-6 rounded-xl font-bold" 
          onClick={() => router.push(`/cms/${tenantSlug}/content/${contentTypeSlug}/new`)}
        >
          <Plus className="mr-2 h-5 w-5" /> New Entry
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="border-none shadow-sm bg-card rounded-2xl">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search in ${contentType?.name}...`} 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/30 border-none rounded-xl"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-xl border-dashed border-muted-foreground/20">
                  <Filter className="h-4 w-4 mr-2" /> Filter Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                {Object.keys(STATUS_CONFIG).map(s => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter.includes(s)}
                    onCheckedChange={(checked) => {
                      setStatusFilter(prev => checked ? [...prev, s] : prev.filter(i => i !== s))
                    }}
                  >
                    {STATUS_CONFIG[s].label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 p-1 px-3 bg-emerald-50 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-black text-emerald-700 uppercase mr-2">{selectedIds.length} Selected</span>
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-emerald-700 hover:bg-emerald-100" onClick={() => handleBulkAction('publish')}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Publish
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-emerald-700 hover:bg-emerald-100" onClick={() => handleBulkAction('unpublish')}>
                <FileText className="h-3.5 w-3.5 mr-1.5" /> Draft
              </Button>
              <Separator orientation="vertical" className="h-4 bg-emerald-200" />
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleBulkAction('delete')}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-none shadow-sm overflow-hidden bg-card rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40px] pl-6">
                  <button onClick={handleToggleSelectAll}>
                    {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-[80px] font-bold text-[10px] uppercase tracking-wider">Cover</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Title / Info</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Last Modified</TableHead>
                <TableHead className="text-right pr-6 font-bold text-[10px] uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Search className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="font-bold">No matches found.</p>
                      <Button variant="link" className="text-emerald-600" onClick={() => {setSearchQuery(""); setStatusFilter(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED"])}}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const data = entry.data || {}
                  const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                  const title = data.judul_berita || data.judul || data.title || "Untitled Entry"
                  const coverUrl = data.cover || data.image || data.thumbnail
                  
                  return (
                    <TableRow key={entry.id} className={cn(
                      "group hover:bg-muted/5 transition-colors",
                      selectedIds.includes(entry.id) && "bg-emerald-50/30"
                    )}>
                      <TableCell className="pl-6">
                        <button onClick={() => handleToggleSelect(entry.id)}>
                          {selectedIds.includes(entry.id) ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-muted-foreground/10 shadow-sm">
                          {coverUrl ? (
                            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-bold text-foreground block max-w-[400px] truncate">{title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[8px] font-black tracking-widest bg-muted/50 border-none">
                            ID-{entry.id.substring(0,6).toUpperCase()}
                          </Badge>
                          {data.kategori && (
                            <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                              <ChevronRight className="h-2.5 w-2.5" /> {typeof data.kategori === 'object' ? 'Custom' : data.kategori}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-black border hover:shadow-sm transition-all", statusCfg.bg)}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                              {statusCfg.label.toUpperCase()}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-40 rounded-xl shadow-xl border-none">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Set Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "DRAFT")} className="text-xs font-bold py-2">
                              <FileText className="mr-2 h-3.5 w-3.5 text-gray-400" /> Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "PUBLISHED")} className="text-xs font-bold text-emerald-600 py-2">
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Published
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "ARCHIVED")} className="text-xs font-bold text-orange-600 py-2">
                              <Archive className="mr-2 h-3.5 w-3.5 text-orange-500" /> Archived
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-muted-foreground">{new Date(entry.updatedAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-muted-foreground/50">{new Date(entry.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-emerald-50 hover:text-emerald-600">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-emerald-50 hover:text-emerald-600" onClick={() => router.push(`/cms/${tenantSlug}/content/${contentTypeSlug}/edit/${entry.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                              <DropdownMenuItem className="text-xs font-medium"><Download className="mr-2 h-3.5 w-3.5" /> Export JSON</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-700 font-bold text-xs" onClick={() => { if(confirm('Delete?')) handleBulkAction('delete') }}>
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Entry
                              </DropdownMenuItem>
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
  )
}
