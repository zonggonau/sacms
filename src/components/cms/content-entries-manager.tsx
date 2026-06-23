"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, Search, Filter,
  CheckSquare, Square, Download, MoreHorizontal, ImageIcon, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; icon: any }> = {
  DRAFT:     { label: "Draft",      dot: "bg-zinc-400",    bg: "bg-muted/30 text-foreground border-border rounded-none", icon: FileText },
  PUBLISHED: { label: "Published",  dot: "bg-zinc-900 dark:bg-zinc-100", bg: "bg-zinc-900/10 dark:bg-zinc-100/10 text-foreground border-zinc-900/20 dark:border-zinc-100/20 rounded-none", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   dot: "bg-orange-500",  bg: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 rounded-none", icon: Archive },
  IN_REVIEW: { label: "In Review",  dot: "bg-zinc-500",    bg: "bg-muted text-muted-foreground border-border rounded-none", icon: Clock },
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
  currentCount = 0
}: { 
  contentType: any, 
  initialEntries: any[],
  tenantSlug: string,
  contentTypeSlug: string,
  isLimitReached?: boolean,
  limit?: number,
  currentCount?: number
}) {
  const router = useRouter()
  
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED"])

  const filteredEntries = useMemo(() => {
    return initialEntries.filter(entry => {
      const data = entry.data || {}
      const title = String(data.judul_berita || data.judul || data.title || "").toLowerCase()
      const matchesSearch = title.includes(searchQuery.toLowerCase())
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
    if (action === 'delete' && !confirm(`Delete ${selectedIds.length} items permanently?`)) return
    
    try {
      const res = await bulkContentAction(tenantSlug, contentTypeSlug, selectedIds, action)
      if (res.success) {
        toast({ title: "Bulk Action Successful", description: `${selectedIds.length} entries updated.` })
        setSelectedIds([])
      } else {
        toast({ variant: "destructive", title: "Bulk Action Failed", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Something went wrong." })
    }
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry permanently?')) return
    try {
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, entryId)
      if (res.success) {
        toast({ title: "Deleted Successfully" })
      } else {
        toast({ variant: "destructive", title: "Failed to delete", description: res.error })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await updateContentEntryStatusAction(tenantSlug, contentTypeSlug, entryId, newStatus)
      if (res.success) {
        toast({ title: "Status Updated" })
      } else {
        toast({ variant: "destructive", title: "Error", description: res.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in fade-in duration-300">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-6 px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-none hover:bg-muted" onClick={() => router.push(`/dashboard/${tenantSlug}/cms`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">{contentType?.name}</h1>
              <p className="text-muted-foreground text-sm">Review and publish your content entries</p>
            </div>
          </div>
          <Button 
            className="bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white shadow-none border border-zinc-900 dark:border-zinc-100 h-11 px-6 rounded-none font-bold transition-colors" 
            onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${contentTypeSlug}/new`)}
            disabled={isLimitReached}
          >
            <Plus className="mr-2 h-5 w-5" /> New Entry
          </Button>
        </div>
      </div>

      {isLimitReached && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-none p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
          <div className="text-xs text-red-800 dark:text-red-300 font-medium">
            You have reached your content entries limit of {limit} entries. Delete an existing entry or upgrade your plan to create more.
          </div>
        </div>
      )}

      <Card className="border border-border shadow-none bg-card rounded-none sticky top-[100px] z-20">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-[300px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={`Search in ${contentType?.name}...`} 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/30 border border-border rounded-none focus-visible:ring-1 focus-visible:ring-orange-500"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 rounded-none border border-dashed border-border hover:border-orange-500">
                  <Filter className="h-4 w-4 mr-2" /> Filter Status
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-none border border-border bg-card shadow-none">
                {Object.keys(STATUS_CONFIG).map(s => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter.includes(s)}
                    onCheckedChange={(checked) => {
                      setStatusFilter(prev => checked ? [...prev, s] : prev.filter(i => i !== s))
                    }}
                    className="rounded-none font-medium"
                  >
                    {STATUS_CONFIG[s].label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 p-1 px-3 bg-muted rounded-none border border-border animate-in fade-in slide-in-from-top-2">
              <span className="text-xs font-black text-foreground uppercase mr-2">{selectedIds.length} Selected</span>
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-background rounded-none border border-transparent hover:border-border" onClick={() => handleBulkAction('publish')}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-orange-500" /> Publish
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-foreground hover:bg-background rounded-none border border-transparent hover:border-border" onClick={() => handleBulkAction('unpublish')}>
                <FileText className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Draft
              </Button>
              <Separator orientation="vertical" className="h-4 bg-border" />
              <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-red-600 hover:bg-red-50/10 rounded-none border border-transparent hover:border-red-600/20" onClick={() => handleBulkAction('delete')}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border shadow-none overflow-hidden bg-card rounded-none">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-[40px] pl-6">
                  <button onClick={handleToggleSelectAll} className="focus:outline-none cursor-pointer">
                    {selectedIds.length === filteredEntries.length && filteredEntries.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-orange-500" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </TableHead>
                {contentType?.fields.slice(0, 5).map((field: any) => (
                  <TableHead key={field.id} className="font-bold text-[10px] uppercase tracking-wider">
                    {field.name}
                  </TableHead>
                ))}
                <TableHead className="font-bold text-[10px] uppercase tracking-wider text-center">Status</TableHead>
                <TableHead className="font-bold text-[10px] uppercase tracking-wider">Last Modified</TableHead>
                <TableHead className="text-right pr-6 font-bold text-[10px] uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={(contentType?.fields.slice(0, 5).length || 0) + 4} className="text-center py-32 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-none bg-muted flex items-center justify-center border border-border">
                        <Search className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="font-bold">No matches found.</p>
                      <Button variant="link" className="text-orange-500 hover:text-orange-600" onClick={() => {setSearchQuery(""); setStatusFilter(["DRAFT", "PUBLISHED", "IN_REVIEW", "ARCHIVED"])}}>Clear filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => {
                  const data = entry.data || {}
                  const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                  
                  return (
                    <TableRow key={entry.id} className={cn(
                      "group hover:bg-muted/5 transition-colors border-b border-border last:border-b-0",
                      selectedIds.includes(entry.id) && "bg-muted/50"
                    )}>
                      <TableCell className="pl-6">
                        <button onClick={() => handleToggleSelect(entry.id)} className="focus:outline-none cursor-pointer">
                          {selectedIds.includes(entry.id) ? (
                            <CheckSquare className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground opacity-30 group-hover:opacity-100" />
                          )}
                        </button>
                      </TableCell>
                      
                      {contentType?.fields.slice(0, 5).map((field: any) => {
                        const val = data[field.slug]
                        const isMedia = ['media', 'image', 'file', 'mediaMultiple', 'gallery', 'picture'].includes(field.type.toLowerCase())
                        const isRichText = ['richtext', 'textarea', 'markdown', 'longtext'].includes(field.type.toLowerCase())
                        
                        return (
                          <TableCell key={field.id} className="py-4">
                            {isMedia ? (
                              <div className="w-12 h-12 rounded-none bg-muted flex items-center justify-center overflow-hidden border border-border shadow-none group-hover:border-orange-500 transition-colors">
                                {val ? (
                                  <img 
                                    src={Array.isArray(val) ? val[0] : String(val)} 
                                    alt="" 
                                    className="w-full h-full object-cover" 
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = ""
                                      (e.target as HTMLImageElement).className = "hidden"
                                    }}
                                  />
                                ) : (
                                  <ImageIcon className="h-5 w-5 text-muted-foreground/20" />
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-foreground truncate max-w-[200px]">
                                  {val ? (isRichText ? stripHtml(String(val)) : String(val)) : "-"}
                                </span>
                                {field.slug === contentType.fields[0]?.slug && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black tracking-widest text-muted-foreground/40 uppercase bg-muted/30 px-1 rounded-none border border-border">
                                      ID: {entry.id.substring(0,8)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                        )
                      })}

                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black border transition-all cursor-pointer", statusCfg.bg)}>
                              <span className={cn("h-1.5 w-1.5 rounded-none", statusCfg.dot)} />
                              {statusCfg.label.toUpperCase()}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="center" className="w-40 rounded-none shadow-none border border-border bg-card">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Set Status</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "DRAFT")} className="text-xs font-bold py-2 rounded-none hover:bg-muted hover:text-orange-500">
                              <FileText className="mr-2 h-3.5 w-3.5 text-gray-400" /> Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "PUBLISHED")} className="text-xs font-bold text-foreground py-2 rounded-none hover:bg-muted hover:text-orange-500">
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-foreground" /> Published
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "ARCHIVED")} className="text-xs font-bold text-orange-500 py-2 rounded-none hover:bg-muted">
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
                        <div className="flex justify-end gap-1.5 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-muted hover:text-orange-500">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-muted hover:text-orange-500" onClick={() => router.push(`/dashboard/${tenantSlug}/cms/content/${contentTypeSlug}/edit/${entry.id}`)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          {contentType?.fields?.some((f: any) => f.type === "document_template") && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-none hover:bg-muted hover:text-blue-500 text-slate-500" 
                              title="Download Surat DOCX"
                              onClick={() => window.open(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entry.id}`, '_blank')}
                            >
                              <Download className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-none hover:bg-muted">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-none border border-border bg-card shadow-none">
                              <DropdownMenuItem className="text-xs font-medium rounded-none hover:bg-muted hover:text-orange-500"><Download className="mr-2 h-3.5 w-3.5" /> Export JSON</DropdownMenuItem>
                              {contentType?.fields?.some((f: any) => f.type === "document_template") && (
                                <DropdownMenuItem 
                                  className="text-xs font-medium rounded-none hover:bg-muted hover:text-blue-500 text-blue-500"
                                  onClick={() => window.open(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entry.id}`, '_blank')}
                                >
                                  <FileText className="mr-2 h-3.5 w-3.5" /> Export DOCX
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="border-t border-border" />
                              <DropdownMenuItem className="text-red-600 focus:text-red-700 font-bold text-xs rounded-none hover:bg-red-50/10" onClick={() => handleDeleteEntry(entry.id)}>
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
