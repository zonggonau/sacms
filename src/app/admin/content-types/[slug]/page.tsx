"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, ArrowLeft, FileText, Edit, Trash2, MoreVertical, 
  Loader2, Globe, ImageIcon, Search, Layout, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "@/hooks/use-toast"
import { GlobalAdminSidebar } from "@/components/dashboard/global-admin-sidebar"
import { cn } from "@/lib/utils"

interface Entry {
  id: string
  data: any
  status: string
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  tenant: {
    id: string
    name: string
    slug: string
  }
}

interface ContentType {
  id: string
  name: string
  slug: string
  description?: string
  fields: Array<{ id: string; name: string; slug: string; type: string }>
}

export default function ContentTypeEntriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string
  
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; entry: Entry | null }>({
    open: false,
    entry: null,
  })
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchData = async () => {
    if (!slug) return
    try {
      const [ctRes, entRes] = await Promise.all([
        fetch(`/api/admin/content-types/by-slug/${slug}`),
        fetch(`/api/admin/content-types/by-slug/${slug}/entries`)
      ])
      
      if (ctRes.ok) setContentType(await ctRes.json())
      if (entRes.ok) {
        const data = await entRes.json()
        const parsedEntries = (data.entries || []).map((e: any) => {
          let parsedData = e.data
          if (typeof e.data === 'string') {
            try { parsedData = JSON.parse(e.data) } catch { parsedData = {} }
          }
          return { ...e, data: parsedData }
        })
        setEntries(parsedEntries)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchData()
  }, [slug, session])

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const stringData = JSON.stringify(entry.data).toLowerCase()
      return stringData.includes(searchQuery.toLowerCase()) || entry.id.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [entries, searchQuery])

  const handleDelete = async () => {
    if (!deleteDialog.entry) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/entries/${deleteDialog.entry.id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Deleted" })
        setDeleteDialog({ open: false, entry: null })
        fetchData()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setDeleting(false)
    }
  }

  if (status === "loading" || loading) return (
    <div className="flex min-h-screen"><GlobalAdminSidebar /><main className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main></div>
  )

  if (session?.user?.role !== "super_admin" || !contentType) return null

  // Columns logic (same as tenant side)
  const displayFields = contentType.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3)
  const mediaField = contentType.fields.find(f => f.type === 'media' || f.type === 'mediaMultiple')

  return (
    <div className="flex min-h-screen bg-muted/10">
      <GlobalAdminSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/admin/content-types")}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{contentType.name}</h1>
                <p className="text-muted-foreground text-sm uppercase font-mono tracking-tighter">Global Data Manager &middot; /{contentType.slug}</p>
              </div>
            </div>
            <Button onClick={() => router.push(`/admin/content-types/${slug}/new`)} className="bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Create Global Entry
            </Button>
          </div>

          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="border-b py-4">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Filter entries..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-9 bg-muted/30 border-none" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredEntries.length === 0 ? (
                <div className="py-24 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground text-sm uppercase">No entries found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[80px] pl-6 font-bold text-[10px] uppercase">Preview</TableHead>
                      {displayFields.map(field => <TableHead key={field.id} className="font-bold text-[10px] uppercase">{field.name}</TableHead>)}
                      <TableHead className="font-bold text-[10px] uppercase">Tenant</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
                      <TableHead className="text-right pr-6 font-bold text-[10px] uppercase">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => {
                      const data = entry.data || {}
                      const coverUrl = mediaField ? data[mediaField.slug] : null
                      return (
                        <TableRow key={entry.id} className="group hover:bg-muted/5 transition-colors">
                          <TableCell className="pl-6">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border shadow-sm">
                              {coverUrl ? <img src={coverUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground/30" />}
                            </div>
                          </TableCell>
                          {displayFields.map((field, idx) => (
                            <TableCell key={field.id}>
                              {idx === 0 ? (
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-foreground block max-w-[200px] truncate">{data[field.slug] || "—"}</span>
                                  <span className="text-[9px] text-muted-foreground font-mono uppercase">ID: {entry.id.substring(0,8)}</span>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">{String(data[field.slug] || "—")}</span>}
                            </TableCell>
                          ))}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {entry.tenant.slug === 'system' ? <Globe className="h-3 w-3 text-blue-500" /> : null}
                              <Badge variant="outline" className="text-[10px] bg-muted/30 font-bold uppercase">{entry.tenant.name}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={entry.status === "PUBLISHED" ? "default" : "secondary"} className="text-[9px] font-black uppercase">{entry.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem onClick={() => router.push(`/admin/content-types/${slug}/edit/${entry.id}`)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteDialog({ open: true, entry })}><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase text-destructive tracking-tight">Delete Entry?</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, entry: null })} className="rounded-xl h-11">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-xl h-11 font-bold">Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
