"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { 
  Save, Eye, EyeOff, FileText, Plus, Edit2, 
  Trash2, Loader2, Sparkles, Search, X, 
  ChevronRight, Calendar, Layers, Globe, MoreVertical, Layout,
  CheckCircle2, AlertCircle, ShieldCheck
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
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
import { cn } from "@/lib/utils"

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: any[]
  data: any
  publishedAt: string | null
  updatedAt: string
  isGlobal: boolean
}

export default function SingleTypesPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { data: session } = useSession()
  const router = useRouter()
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantId, setTenantId] = useState<string>("")
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; singleType: SingleType | null }>({
    open: false,
    singleType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const tenants = session?.user?.tenants || []
  const isSuperAdmin = session?.user?.role === "super_admin"

  const fetchSingleTypes = useCallback(async (tenant: string) => {
    if (!tenant || tenant === "undefined") return
    try {
      setLoading(true)
      const response = await fetch(`/api/tenant/${tenant}/single-types`)
      if (response.status === 403) {
        router.push("/dashboard")
        return
      }
      if (!response.ok) throw new Error("Failed to fetch single types")
      const data = await response.json()
      setSingleTypes(data)
    } catch (error) {
      console.error("Error fetching single types:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load single types",
      })
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const init = async () => {
      const { tenant } = await params
      if (tenant && tenant !== "undefined") {
        setTenantId(tenant)
        await fetchSingleTypes(tenant)
      }
    }
    init()
  }, [params, fetchSingleTypes])

  const filteredSingleTypes = useMemo(() => {
    return singleTypes.filter(st => 
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      st.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [singleTypes, searchTerm])

  const handlePublishToggle = async (singleType: SingleType, publish: boolean) => {
    try {
      const response = await fetch(`/api/tenant/${tenantId}/single-types`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          singleTypeId: singleType.id,
          publish,
        }),
      })

      if (!response.ok) throw new Error(`Failed to ${publish ? 'publish' : 'unpublish'}`)

      toast({
        title: publish ? "Published!" : "Unpublished",
        description: `${singleType.name} is now ${publish ? 'live' : 'draft'}.`,
        className: publish ? "bg-emerald-50 border-emerald-200 text-emerald-800" : ""
      })

      await fetchSingleTypes(tenantId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${publish ? 'publish' : 'unpublish'}`,
      })
    }
  }

  const handleDeleteClick = (singleType: SingleType) => {
    setDeleteDialog({ open: true, singleType })
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!deleteDialog.singleType) return
    if (deleteConfirmName !== deleteDialog.singleType.name) {
      toast({ variant: "destructive", title: "Error", description: "Verification name does not match" })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/tenant/${tenantId}/single-types/${deleteDialog.singleType.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "Deleted",
        description: `${deleteDialog.singleType.name} has been removed.`,
      })

      setDeleteDialog({ open: false, singleType: null })
      await fetchSingleTypes(tenantId)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete single type",
      })
    } finally {
      setDeleting(false)
    }
  }

  if (loading && singleTypes.length === 0) {
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
      <div className="flex-1 bg-[#f6f6f9] text-foreground flex flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Single Types</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Manage your singleton content structures and data.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-none"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> AI Generate
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white font-bold rounded-none shadow-none"
                onClick={() => router.push(`/dashboard/${tenantId}/single-types/new`)}
              >
                <Plus className="mr-2 h-4 w-4" /> New Single Type
              </Button>
            </div>
          </div>

          {/* Stats/Quick Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Types</p>
                  <p className="text-xl font-black">{singleTypes.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-blue-100 flex items-center justify-center text-blue-600">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Published</p>
                  <p className="text-xl font-black">{singleTypes.filter(s => s.publishedAt).length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-amber-100 flex items-center justify-center text-amber-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Drafts</p>
                  <p className="text-xl font-black">{singleTypes.filter(s => !s.publishedAt).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter & List Area */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white rounded-none">
            <CardHeader className="bg-white border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search single types..." 
                    className="pl-10 h-10 bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSingleTypes.length === 0 ? (
                <div className="py-24 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground">No single types found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {searchTerm ? `No results for "${searchTerm}". Try another keyword.` : "Start by creating a new structure for your singleton content."}
                  </p>
                  {!searchTerm && (
                    <Button 
                      className="mt-8 rounded-none font-bold bg-primary hover:bg-primary/90 text-white shadow-none"
                      onClick={() => setIsAIModalOpen(true)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#f6f6f9] border-b border-slate-200">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 pl-6">Structure Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">API Slug</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Fields</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Last Updated</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSingleTypes.map((st) => (
                      <TableRow key={st.id} className="group hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/${tenantId}/single-types/${st.slug}`)}>
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-none bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                              <FileText className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground">{st.name}</span>
                                {st.isGlobal && <Badge variant="outline" className="text-[8px] uppercase font-black px-1.5 h-4 border-primary/20 text-primary">Global</Badge>}
                              </div>
                              {st.description && <p className="text-[11px] text-muted-foreground truncate max-w-[200px] mt-0.5">{st.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[11px] font-mono font-bold bg-muted px-2 py-1 rounded-none text-muted-foreground">/{st.slug}</code>
                        </TableCell>
                        <TableCell className="text-center font-bold text-xs">{st.fields.length}</TableCell>
                        <TableCell className="text-center">
                          {st.publishedAt ? (
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
                        <TableCell className="text-center text-xs font-medium text-slate-500">
                          {st.updatedAt ? new Date(st.updatedAt).toLocaleDateString() : "Never"}
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 items-center">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs font-bold rounded-none border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-none"
                              asChild
                            >
                              <Link href={`/dashboard/${tenantId}/single-types/${st.slug}`}>
                                <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit Content
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                {(!st.isGlobal || isSuperAdmin) && (
                                  <DropdownMenuItem onClick={() => router.push(`/dashboard/${tenantId}/single-types/${st.slug}/edit`)}>
                                    <Layout className="mr-2 h-4 w-4" /> Edit Schema
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handlePublishToggle(st, !st.publishedAt)}>
                                  {st.publishedAt ? (
                                    <><EyeOff className="mr-2 h-4 w-4" /> Unpublish</>
                                  ) : (
                                    <><Save className="mr-2 h-4 w-4" /> Publish Now</>
                                  )}
                                </DropdownMenuItem>
                                {(!st.isGlobal || isSuperAdmin) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleDeleteClick(st)} className="text-destructive focus:text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info Banner */}
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-none flex gap-4 text-primary shadow-none">
            <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest">Governance Policy</p>
              <p className="text-[11px] leading-relaxed mt-1 opacity-80 max-w-2xl">
                Single types are designed for single-entry content (like Homepage, About Us, or Global Settings). Custom structures are private to this workspace, while global structures are administered platform-wide.
              </p>
            </div>
          </div>

        </div>
      </div>

      <SchemaGeneratorDialog
        tenantId={tenantId}
        type="single-type"
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        onSuccess={() => fetchSingleTypes(tenantId)}
      />

      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-none border-none shadow-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase tracking-tight text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Critical Action
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">
              You are about to delete <strong>"{deleteDialog.singleType?.name}"</strong>. This will also erase all associated content permanently.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-4 bg-destructive/10 rounded-none border border-destructive/20">
              <p className="text-xs font-bold text-destructive">To confirm, type the exact name of the schema below:</p>
              <p className="text-sm font-black mt-1 text-destructive">{deleteDialog.singleType?.name}</p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Confirm schema name"
              className="bg-muted/30 border-none h-10"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-none h-10" onClick={() => setDeleteDialog({ open: false, singleType: null })}>Cancel</Button>
            <Button
              variant="destructive"
              className="rounded-none h-10 font-bold"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deleteDialog.singleType?.name}
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
