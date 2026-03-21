"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, MoreVertical, Edit, Trash2, FileText, Database, 
  Globe, Lock, Layout, ArrowRight, Loader2, Search,
  Filter, CheckCircle2, AlertCircle, Sparkles
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
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
import { cn } from "@/lib/utils"

interface ContentType {
  id: string
  name: string
  slug: string
  description: string | null
  isPublished: boolean
  isGlobal: boolean
  fields: any[]
  entryCount: number
}

export default function ContentTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; contentType: ContentType | null }>({
    open: false,
    contentType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  const fetchContentTypes = async () => {
    if (!tenantSlug) return
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/content-types`)
      if (response.status === 403 || response.status === 404) {
        router.push("/dashboard")
        return
      }
      if (!response.ok) throw new Error("Failed to load schemas")
      const data = await response.json()
      setContentTypes(data || [])
    } catch (error) {
      console.error("Error fetching content types:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load content types" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchContentTypes()
  }, [tenantSlug, session])

  const filteredTypes = useMemo(() => {
    return contentTypes.filter(ct => 
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [contentTypes, searchQuery])

  const handleDeleteClick = (contentType: ContentType) => {
    setDeleteDialog({ open: true, contentType })
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!deleteDialog.contentType) return
    if (deleteConfirmName !== deleteDialog.contentType.name) {
      toast({ variant: "destructive", title: "Error", description: "Verification name does not match" })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(
        `/api/tenant/${tenantSlug}/content-types/${deleteDialog.contentType.id}`,
        { method: "DELETE" }
      )
      if (!response.ok) throw new Error("Delete failed")
      toast({ title: "Success", description: "Content type removed" })
      setDeleteDialog({ open: false, contentType: null })
      fetchContentTypes()
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete" })
    } finally {
      setDeleting(false)
    }
  }

  if (status === "loading" || (loading && contentTypes.length === 0)) {
    return (
      <div className="flex">
        <TenantSidebar tenantSlug={tenantSlug} />
        <main className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Content Schemas</h1>
              <p className="text-muted-foreground">Manage data structures and collection definitions.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> AI Generate
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                onClick={() => router.push(`/dashboard/${tenantSlug}/content-types/new`)}
              >
                <Plus className="mr-2 h-4 w-4" /> Create New Schema
              </Button>
            </div>
          </div>

          {/* Schema Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layout className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Schemas</p>
                  <p className="text-xl font-black">{contentTypes.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Library</p>
                  <p className="text-xl font-black">{contentTypes.filter(c => c.isGlobal).length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Workspace Custom</p>
                  <p className="text-xl font-black">{contentTypes.filter(c => !c.isGlobal).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter & List Area */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-card border-b">
              <div className="flex items-center justify-between">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filter schemas..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 bg-muted/30 border-none" 
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredTypes.length === 0 ? (
                <div className="py-24 text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground">No schemas found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Start by creating a custom schema for your workspace.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Structure Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Source</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Fields</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Data Entries</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Status</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTypes.map((ct) => (
                      <TableRow 
                        key={ct.id} 
                        className="group hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/dashboard/${tenantSlug}/content-types/${ct.slug}`)}
                      >
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                              <FileText className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">{ct.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">{ct.slug}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {ct.isGlobal ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] font-black tracking-widest">SYSTEM</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black tracking-widest">CUSTOM</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{ct.fields.length}</TableCell>
                        <TableCell className="text-center font-bold text-xs">
                          <Badge variant="secondary" className="font-black text-[10px] bg-muted">{ct.entryCount.toLocaleString()}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {ct.isPublished ? (
                            <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="text-[10px] font-black uppercase">Live</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-[10px] font-black uppercase">Draft</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantSlug}/content-types/edit/${ct.slug}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Schema
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantSlug}/content-types/${ct.slug}`)}>
                                <Layout className="mr-2 h-4 w-4" /> Browse Entries
                              </DropdownMenuItem>
                              {!ct.isGlobal && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteClick(ct)} className="text-destructive focus:text-destructive">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info Banner */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-4 text-primary shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Governance Policy</p>
              <p className="text-[11px] leading-relaxed mt-1 opacity-80 max-w-2xl">
                System schemas are managed globally by platform administrators and are read-only. Custom schemas created within this workspace are private and can be modified at any time by workspace admins.
              </p>
            </div>
          </div>
        </div>
      </main>

      <SchemaGeneratorDialog
        tenantSlug={tenantSlug}
        type="schema"
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        onSuccess={fetchContentTypes}
      />

      {/* Delete Dialog */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Critical Action
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">
              You are about to delete <strong>"{deleteDialog.contentType?.name}"</strong>. This will also erase all associated content entries permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-destructive/10 rounded-xl border border-destructive/20">
              <p className="text-xs font-bold text-destructive">To confirm, type the exact name of the schema below:</p>
              <p className="text-sm font-black mt-1 text-destructive">{deleteDialog.contentType?.name}</p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Confirm schema name"
              className="bg-muted/30 border-none h-10"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl h-10" onClick={() => setDeleteDialog({ open: false, contentType: null })}>Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-xl h-10 font-bold"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deleteDialog.contentType?.name}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Erase Schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { ShieldCheck } from "lucide-react"
