"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, MoreVertical, Edit, Trash2, FileText, 
  Search, ShieldCheck, Layers, Globe, Package,
  ArrowRight, Loader2, Info, Copy, ExternalLink
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
import { cn } from "@/lib/utils"

interface SingleType {
  id: string
  name: string
  slug: string
  description?: string
  isPublished: boolean
  createdAt: string
  fields: Array<{ id: string; name: string; type: string }>
  tenants: Array<{ tenant: { id: string; name: string; slug: string } }>
}

export default function SingleTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; singleType: SingleType | null }>({
    open: false,
    singleType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchSingleTypes = async () => {
    try {
      const res = await fetch("/api/admin/single-types")
      if (res.ok) {
        const data = await res.json()
        setSingleTypes(data.singleTypes || [])
      }
    } catch (error) {
      console.error("Failed to fetch single types:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchSingleTypes()
    }
  }, [session])

  const filteredSingleTypes = useMemo(() => {
    return singleTypes.filter(st => 
      st.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      st.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [singleTypes, searchQuery])

  const handleDeleteClick = (singleType: SingleType) => {
    setDeleteDialog({ open: true, singleType })
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!deleteDialog.singleType) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/single-types/${deleteDialog.singleType.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Success", description: "Single type deleted successfully" })
        setDeleteDialog({ open: false, singleType: null })
        fetchSingleTypes()
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to delete" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error" })
    } finally {
      setDeleting(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
<div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight uppercase">Single Types</h1>
              <p className="text-muted-foreground">Manage singleton content schemas for your platform.</p>
            </div>
            <Button 
              onClick={() => router.push("/admin/single-types/new")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 font-bold"
            >
              <Plus className="mr-2 h-4 w-4" /> Create Single Type
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Singles</p>
                  <p className="text-xl font-black">{singleTypes.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Fields</p>
                  <p className="text-xl font-black">{singleTypes.reduce((acc, st) => acc + (st.fields?.length || 0), 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Connected Tenants</p>
                  <p className="text-xl font-black">{new Set(singleTypes.flatMap(st => st.tenants?.map(t => t.tenant.id) || [])).size}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* List */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-card border-b py-4">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search single types..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-muted/30 border-none" 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredSingleTypes.length === 0 ? (
                <div className="py-24 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground text-sm uppercase">No single types defined</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6 font-bold text-[10px] uppercase">Identity</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Fields</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Tenants</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSingleTypes.map((st) => (
                      <TableRow 
                        key={st.id} 
                        className="group hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/single-types/${st.slug}`)}
                      >
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{st.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{st.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-bold text-[10px] bg-muted/30">{st.fields?.length || 0}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium text-muted-foreground">
                          {st.tenants?.length || 0} tenants
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={st.isPublished ? "default" : "secondary"}
                            className="text-[9px] font-black uppercase px-1.5 h-4"
                          >
                            {st.isPublished ? "Live" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/admin/single-types/edit/${st.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Schema
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteClick(st)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
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

          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-4 text-primary shadow-sm">
            <Info className="h-5 w-5 shrink-0" />
            <div>
              <p className="text-[11px] leading-relaxed font-bold uppercase tracking-tight">Global Management</p>
              <p className="text-[10px] mt-0.5 opacity-80">
                Single types are singleton content schemas (e.g., Homepage, About Us) shared across all tenants.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <DialogContent className="rounded-3xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-destructive tracking-tight">Danger Zone</DialogTitle>
            <DialogDescription className="text-sm font-medium">
              Permanently delete <strong>"{deleteDialog.singleType?.name}"</strong>? This will also remove data for ALL tenants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">
                Type <span className="text-foreground">{deleteDialog.singleType?.name}</span> to confirm
              </label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Confirm name..."
                className="bg-muted/30 border-none h-11 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, singleType: null })} className="rounded-xl h-11">Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deleteDialog.singleType?.name}
              className="rounded-xl h-11 font-bold shadow-lg shadow-destructive/20"
            >
              {deleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}