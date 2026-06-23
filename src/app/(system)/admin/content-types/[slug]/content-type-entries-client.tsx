"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, XCircle, MoreHorizontal,
  ImageIcon, Calendar, Loader2, Send, Search, X, Download,
  AlertCircle
} from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getContentTypeBySlugAction } from "@/actions/content-types"
import { getEntriesAction, updateEntryAction, deleteEntryAction } from "@/actions/content"

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
  SCHEDULED: { label: "Scheduled",  dot: "bg-purple-500",  bg: "bg-purple-50 text-purple-700 border-purple-200", icon: Calendar },
}

export default function ContentTypeEntriesClient({
  tenantSlug,
  contentTypeSlug,
  initialContentType,
  initialEntries
}: {
  tenantSlug: string
  contentTypeSlug: string
  initialContentType: ContentType | null
  initialEntries: Entry[]
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [contentType, setContentType] = useState<ContentType | null>(initialContentType)
  const [entries, setEntries] = useState<Entry[]>(initialEntries)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [entriesLimit, setEntriesLimit] = useState(100)

  const tenants = session?.user?.tenants || []

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const fetchData = useCallback(async () => {
    if (!tenantSlug || !contentTypeSlug) return
    try {
      setLoading(true)
      
      const [ctRes, entriesRes, usageRes] = await Promise.all([
        getContentTypeBySlugAction(tenantSlug, contentTypeSlug),
        getEntriesAction(tenantSlug, contentTypeSlug, { 
          page: 1, 
          pageSize: 50, 
          search: debouncedSearch 
        }),
        fetch(`/api/tenant/${tenantSlug}/billing/usage`)
      ])
      
      if (ctRes.contentType) setContentType(ctRes.contentType)
      
      if (entriesRes.entries) {
        const parsedEntries = entriesRes.entries.map((e: any) => ({
          ...e,
          data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        }))
        setEntries(parsedEntries)
      } else if (entriesRes.error) {
        throw new Error(entriesRes.error)
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json()
        const entriesUsage = usageData.usage?.find((u: any) => u.label === "Content Entries")
        if (entriesUsage) {
          setEntriesLimit(entriesUsage.limit)
          setIsLimitReached(entriesUsage.current >= entriesUsage.limit)
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load entries" })
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, contentTypeSlug, debouncedSearch])

  useEffect(() => {
    if (session?.user) fetchData()
  }, [fetchData, session])

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const res = await updateEntryAction(tenantSlug, contentTypeSlug, entryId, {
        data: undefined, // Status only update
        status: newStatus,
        locale: "en" // We just use en for list view status update for now
      })
      
      if (res.success) {
        toast({ title: "Status Updated", description: `Entry is now ${newStatus.toLowerCase()}` })
        fetchData()
      } else {
        throw new Error(res.error || "Failed to update status")
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Status change failed" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    try {
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, id)
      if (res.success) {
        toast({ title: "Deleted" })
        fetchData()
      } else {
        throw new Error(res.error || "Failed to delete")
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    }
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{contentType?.name}</h1>
                <p className="text-muted-foreground">Manage your collection entries</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entries..."
                  className="pl-9 pr-9 h-10 rounded-none bg-card border shadow-none focus-visible:ring-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button 
                className="bg-primary hover:bg-primary/90 shadow-none shadow-none h-10 rounded-none font-bold" 
                onClick={() => router.push(`/admin/content-types/${contentTypeSlug}/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-2 h-4 w-4" /> New Entry
              </Button>
            </div>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-none p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
              <div className="text-xs text-red-800 dark:text-red-300 font-medium">
                You have reached your content entries limit of {entriesLimit} entries. Delete an existing entry or upgrade your plan to create more.
              </div>
            </div>
          )}

          <Card className="border rounded-none shadow-none overflow-hidden bg-card">
            <CardContent className="p-0">
              {loading && entries.length > 0 && (
                <div className="absolute inset-0 bg-card/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[80px] pl-6 font-bold text-[10px] uppercase">Preview</TableHead>
                    {contentType?.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3).map(field => (
                      <TableHead key={field.id} className="font-bold text-[10px] uppercase">{field.name}</TableHead>
                    ))}
                    <TableHead className="font-bold text-[10px] uppercase">Status</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase">Last Updated</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-[10px] uppercase">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-20 text-muted-foreground">
                        {debouncedSearch ? "No entries match your search." : "No entries found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
                      const data = entry.data || {}
                      const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                      
                      // Find primary fields for display
                      const displayFields = contentType?.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3) || []
                      
                      // Find a media field for preview
                      const mediaField = contentType?.fields.find(f => f.type === 'media' || f.type === 'mediaMultiple')
                      const coverUrl = mediaField ? (Array.isArray(data[mediaField.slug]) ? data[mediaField.slug][0] : data[mediaField.slug]) : null
                      
                      return (
                        <TableRow key={entry.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell className="pl-6">
                            <div className="w-10 h-10 rounded-none bg-muted flex items-center justify-center overflow-hidden border shadow-none">
                              {coverUrl ? (
                                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
                              )}
                            </div>
                          </TableCell>
                          
                          {displayFields.map((field, idx) => {
                            const val = data[field.slug]
                            return (
                              <TableCell key={field.id}>
                                {idx === 0 ? (
                                  <div className="flex flex-col">
                                    <span className="text-sm font-bold text-foreground block max-w-[250px] truncate">
                                      {val || "—"}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground font-mono uppercase">ID: {entry.id.substring(0,8)}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{typeof val === 'object' ? JSON.stringify(val) : String(val || "—")}</span>
                                )}
                              </TableCell>
                            )
                          })}

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 text-[9px] font-black border hover:opacity-80 transition-opacity", statusCfg.bg)}>
                                  <span className={cn("h-1 w-1 rounded-none", statusCfg.dot)} />
                                  {statusCfg.label.toUpperCase()}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-40 rounded-none">
                                <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-50">Set Status</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "DRAFT")} className="text-xs font-bold">
                                  <FileText className="mr-2 h-3.5 w-3.5 text-gray-400" /> Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "PUBLISHED")} className="text-xs font-bold text-emerald-600">
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Published
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "ARCHIVED")} className="text-xs font-bold text-orange-600">
                                  <Archive className="mr-2 h-3.5 w-3.5 text-orange-500" /> Archived
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(entry.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1">
                              {contentType?.fields?.some((f: any) => f.type === "document_template") && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 rounded-none hover:bg-green-50 hover:text-green-600 text-green-600" 
                                  onClick={() => window.open(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entry.id}`, '_blank')}
                                  title="Download Surat DOCX"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-blue-50 hover:text-blue-600" onClick={() => window.open(`/preview/${tenantSlug}/${contentTypeSlug}/${entry.id}`, '_blank')}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => router.push(`/admin/content-types/${contentTypeSlug}/${entry.id}/edit`)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-red-50 hover:text-red-600" onClick={() => handleDelete(entry.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
