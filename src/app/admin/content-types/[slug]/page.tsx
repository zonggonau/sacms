"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, ArrowLeft, FileText, Edit, Trash2, MoreVertical, 
  Loader2, Globe, ImageIcon, Search, Layout, Calendar,
  Sparkles, Wand2
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/hooks/use-toast"
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

  // AI Generator State
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState("")
  const [generatingAI, setGeneratingAI] = useState(false)

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

  const handleAIGenerate = async () => {
    if (!aiPrompt || !contentType) return
    setGeneratingAI(true)
    const isTemplate = slug === 'templates'
    
    try {
      const res = await fetch("/api/admin/ai/generate-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            prompt: aiPrompt, 
            isTemplate,
            contentType: !isTemplate ? contentType : undefined
        })
      })
      
      if (res.ok) {
        const result = await res.json()
        
        if (isTemplate) {
            // Logic for Architecture/Template generation
            const entryData = {
                name: aiPrompt.substring(0, 30) + (aiPrompt.length > 30 ? "..." : ""),
                description: `AI Generated architecture for: ${aiPrompt}`,
                icon: "Sparkles",
                template_id: `ai-${Date.now()}`,
                kategori_website: aiPrompt.toLowerCase().includes("gov") ? "Government" : 
                                 aiPrompt.toLowerCase().includes("shop") || aiPrompt.toLowerCase().includes("ecommerce") ? "E-commerce" :
                                 aiPrompt.toLowerCase().includes("news") || aiPrompt.toLowerCase().includes("portal") ? "News & Portal" : "Custom",
                schema_template: result.schema
            }

            const createRes = await fetch(`/api/admin/content-types/by-slug/${slug}/entries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    data: entryData,
                    status: "PUBLISHED",
                    locale: "en"
                })
            })

            if (createRes.ok) {
                toast({ title: "Template Generated!", description: "AI has successfully designed your CMS architecture." })
                setAiDialogOpen(false)
                setAiPrompt("")
                fetchData()
            }
        } else {
            // Logic for Content Entry generation
            const entriesToCreate = result.entries || []
            let successCount = 0

            for (const entryData of entriesToCreate) {
                const createRes = await fetch(`/api/admin/content-types/by-slug/${slug}/entries`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        data: entryData,
                        status: "PUBLISHED",
                        locale: "en"
                    })
                })
                if (createRes.ok) successCount++
            }

            if (successCount > 0) {
                toast({ title: "Content Generated!", description: `AI has successfully written ${successCount} entries for ${contentType.name}.` })
                setAiDialogOpen(false)
                setAiPrompt("")
                fetchData()
            }
        }
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "AI Error", description: err.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to connect to AI" })
    } finally {
      setGeneratingAI(false)
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
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></div>
  )

  if (session?.user?.role !== "super_admin" || !contentType) return null

  // Columns logic (same as tenant side)
  const displayFields = contentType.fields.filter(f => !['component', 'relation', 'richText', 'textarea', 'json'].includes(f.type)).slice(0, 3)
  const mediaField = contentType.fields.find(f => f.type === 'media' || f.type === 'mediaMultiple')

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.push("/admin/content-types")}><ArrowLeft className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">{contentType.name}</h1>
                <p className="text-muted-foreground text-sm uppercase font-mono tracking-tighter">Global Data Manager &middot; /{contentType.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={() => setAiDialogOpen(true)}
                className="border-primary/20 hover:bg-primary/5 text-primary font-bold shadow-sm"
              >
                <Sparkles className="mr-2 h-4 w-4" /> AI Generator
              </Button>
              <Button onClick={() => router.push(`/admin/content-types/${slug}/new`)} className="bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" /> Create Global Entry
              </Button>
            </div>
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
                            <div className="w-10 h-10 rounded-none bg-muted flex items-center justify-center overflow-hidden border border-border shadow-sm">
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
      </div>

      <Dialog open={deleteDialog.open} onOpenChange={open => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-none border border-border shadow-none bg-card">
          <DialogHeader><DialogTitle className="text-xl font-black uppercase text-destructive tracking-tight">Delete Entry?</DialogTitle><DialogDescription>This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, entry: null })} className="rounded-none border border-border h-11">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="rounded-none border border-border h-11 font-bold">Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="rounded-none border border-border shadow-none sm:max-w-[500px] max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {slug === 'templates' ? 'AI Architect' : 'AI Content Writer'}
            </DialogTitle>
            <DialogDescription>
              {slug === 'templates' 
                ? 'Describe the system you want to build. AI will generate the architecture.' 
                : `Describe what content you want to generate for ${contentType.name}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                {slug === 'templates' ? 'What are we building?' : 'What content should I write?'}
              </label>
              <Textarea 
                placeholder={slug === 'templates' 
                    ? "e.g. A News Portal with categories and featured articles..." 
                    : `e.g. Write 3 pricing plans for a SaaS startup...`}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="min-h-[120px] bg-muted/30 border border-border rounded-none resize-none focus-visible:ring-primary shadow-inner"
              />
            </div>
            <div className="p-4 bg-primary/5 rounded-none border border-primary/10 flex gap-3 items-start">
              <Wand2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-primary/80 leading-relaxed font-medium">
                {slug === 'templates' 
                    ? "AI will follow the Master Template standard for compatibility." 
                    : `AI will automatically fill fields like ${contentType.fields.slice(0, 2).map(f => f.name).join(', ')} etc.`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAiDialogOpen(false)} disabled={generatingAI} className="rounded-none border border-border font-bold">Cancel</Button>
            <Button onClick={handleAIGenerate} disabled={generatingAI || !aiPrompt} className="bg-primary hover:bg-primary/90 font-bold rounded-none h-11 px-8 shadow-lg shadow-primary/20 border border-primary">
              {generatingAI ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generatingAI ? "Processing..." : "Generate with AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
