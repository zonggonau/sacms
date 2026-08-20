"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, Plus, Edit, Trash2, FileText, Eye, 
  Clock, CheckCircle2, Archive, XCircle,
  ImageIcon, Calendar, Loader2, Send, Search, X, Download,
  AlertCircle
} from "lucide-react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { getContentTypeBySlugAction } from "@/actions/content-types"
import { getEntriesAction, updateContentEntryStatusAction, deleteEntryAction } from "@/actions/content"

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
  DRAFT:     { label: "Draft",      dot: "bg-muted-foreground", bg: "bg-muted text-muted-foreground border-border", icon: FileText },
  PUBLISHED: { label: "Published",  dot: "bg-emerald-500",      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  ARCHIVED:  { label: "Archived",   dot: "bg-amber-500",        bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", icon: Archive },
  IN_REVIEW: { label: "In Review",  dot: "bg-blue-500",         bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20", icon: Clock },
  SCHEDULED: { label: "Scheduled",  dot: "bg-purple-500",       bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20", icon: Calendar },
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
  const { data: session } = useSession()
  const router = useRouter()
  
  const [contentType, setContentType] = useState<ContentType | null>(initialContentType)
  const [entries, setEntries] = useState<Entry[]>(initialEntries || [])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLimitReached, setIsLimitReached] = useState(false)
  const [entriesLimit, setEntriesLimit] = useState(100)

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
      const [typeRes, entriesRes] = await Promise.all([
        getContentTypeBySlugAction(tenantSlug, contentTypeSlug),
        getEntriesAction(tenantSlug, contentTypeSlug, { search: debouncedSearch })
      ])

      if (typeRes.contentType) {
        setContentType(typeRes.contentType as unknown as ContentType)
      }
      if (entriesRes.entries) {
        setEntries(entriesRes.entries as unknown as Entry[])
      }
    } catch (err) {
      toast({ title: "Error", description: "Gagal memuat data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [tenantSlug, contentTypeSlug, debouncedSearch])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await updateContentEntryStatusAction(tenantSlug, contentTypeSlug, id, newStatus)
      if (res && "success" in res && res.success) {
        toast({ title: "Status Diperbarui", description: `Entri diubah menjadi ${newStatus}` })
        fetchData()
      } else {
        toast({ title: "Gagal", description: (res as any)?.error || "Gagal mengubah status", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Terjadi kesalahan sistem", variant: "destructive" })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus entri ini?")) return
    try {
      const res = await deleteEntryAction(tenantSlug, contentTypeSlug, id)
      if (res.success) {
        toast({ title: "Entri Dihapus" })
        fetchData()
      } else {
        toast({ title: "Gagal Menghapus", description: res.error, variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: "Gagal menghapus entri", variant: "destructive" })
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href={`/dashboard/${tenantSlug}/content-type-builder/content-types`}>
                <Button variant="ghost" size="icon" className="rounded-xl h-8 w-8 hover:bg-muted/60">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black tracking-tight text-foreground">{contentType?.name || contentTypeSlug}</h1>
                  <Badge variant="secondary" className="text-xs font-bold px-2 py-0.5 rounded-full">
                    {entries.length} Entri
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Kelola data entri untuk koleksi ini.</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari entri..."
                  className="pl-9 pr-8 h-9 rounded-xl bg-card border-border/80 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-9 px-4 rounded-xl font-bold text-xs shadow-xs" 
                onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/${contentTypeSlug}/new`)}
                disabled={isLimitReached}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Entri Baru
              </Button>
            </div>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 shadow-xs">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Anda telah mencapai kuota maksimum {entriesLimit} entri. Hapus entri lama atau upgrade paket untuk menambah entri.
              </div>
            </div>
          )}

          <Card className="border border-border/80 rounded-2xl shadow-xs overflow-hidden bg-card">
            <CardContent className="p-0 relative">
              {loading && entries.length > 0 && (
                <div className="absolute inset-0 bg-card/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              )}
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-[70px] pl-6 font-bold text-xs">Preview</TableHead>
                    {contentType?.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3).map(field => (
                      <TableHead key={field.id} className="font-bold text-xs">{field.name}</TableHead>
                    ))}
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs">Diperbarui</TableHead>
                    <TableHead className="text-right pr-6 font-bold text-xs"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-xs text-muted-foreground">
                        {debouncedSearch ? "Tidak ada entri yang cocok dengan pencarian." : "Belum ada entri konten."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    entries.map((entry) => {
                      const data = entry.data || {}
                      const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.DRAFT
                      
                      const displayFields = contentType?.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3) || []
                      const mediaField = contentType?.fields.find(f => f.type === 'media' || f.type === 'mediaMultiple')
                      const coverUrl = mediaField ? (Array.isArray(data[mediaField.slug]) ? data[mediaField.slug][0] : data[mediaField.slug]) : null
                      
                      return (
                        <TableRow key={entry.id} className="group hover:bg-muted/40 transition-colors border-b border-border/60">
                          <TableCell className="pl-6 py-3">
                            <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center overflow-hidden border border-border/60">
                              {coverUrl ? (
                                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                              )}
                            </div>
                          </TableCell>
                          
                          {displayFields.map((field, idx) => {
                            const val = data[field.slug]
                            return (
                              <TableCell key={field.id} className="py-3">
                                {idx === 0 ? (
                                  <div className="flex flex-col">
                                    <span className="text-xs font-bold text-foreground block max-w-[250px] truncate">
                                      {val || "—"}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground font-mono">ID: {entry.id.substring(0,8)}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">{typeof val === 'object' ? JSON.stringify(val) : String(val || "—")}</span>
                                )}
                              </TableCell>
                            )
                          })}

                          <TableCell className="py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition-opacity cursor-pointer", statusCfg.bg)}>
                                  <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                                  {statusCfg.label}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-36 rounded-xl">
                                <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground">Ubah Status</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "DRAFT")} className="text-xs font-medium cursor-pointer rounded-lg">
                                  <FileText className="mr-2 h-3.5 w-3.5 text-muted-foreground" /> Draft
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "PUBLISHED")} className="text-xs font-medium cursor-pointer rounded-lg text-emerald-600">
                                  <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-emerald-500" /> Published
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(entry.id, "ARCHIVED")} className="text-xs font-medium cursor-pointer rounded-lg text-amber-600">
                                  <Archive className="mr-2 h-3.5 w-3.5 text-amber-500" /> Archived
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground py-3">
                            {new Date(entry.updatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right pr-6 py-3">
                            <div className="flex justify-end gap-1">
                              {contentType?.fields?.some((f: any) => f.type === "document_template") && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 rounded-lg text-emerald-600 hover:bg-emerald-500/10" 
                                  onClick={() => window.open(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/export-docx/${entry.id}`, '_blank')}
                                  title="Download Surat DOCX"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => window.open(`/preview/${tenantSlug}/${contentTypeSlug}/${entry.id}`, '_blank')}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/${contentTypeSlug}/${entry.id}/edit`)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => handleDelete(entry.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
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
