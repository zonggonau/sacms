"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, MoreVertical, Edit, Trash2, Database, 
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

interface ContentType {
  id: string
  name: string
  slug: string
  description?: string
  isPublished: boolean
  createdAt: string
  fields: Array<{ id: string; name: string; type: string }>
  tenants: Array<{ tenant: { id: string; name: string; slug: string } }>
  _count?: { entries: number }
}

export default function ContentTypesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; contentType: ContentType | null }>({
    open: false,
    contentType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchContentTypes = async () => {
    try {
      const res = await fetch("/api/admin/content-types")
      if (res.ok) {
        const data = await res.json()
        setContentTypes(data.contentTypes || [])
      }
    } catch (error) {
      console.error("Failed to fetch content types:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") {
      fetchContentTypes()
    }
  }, [session])

  const filteredContentTypes = useMemo(() => {
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
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/content-types/${deleteDialog.contentType.id}`, {
        method: "DELETE",
      })
      if (res.ok) {
        toast({ title: "Success", description: "Content type deleted successfully" })
        setDeleteDialog({ open: false, contentType: null })
        fetchContentTypes()
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
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight uppercase">Startup Management</h1>
              <p className="text-muted-foreground">Manage core schemas for your startup ecosystem.</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Layers className="h-5 w-5" />
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
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Platform Entries</p>
                  <p className="text-xl font-black">{contentTypes.reduce((acc, ct) => acc + (ct._count?.entries || 0), 0)}</p>
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
                  <p className="text-xl font-black">{new Set(contentTypes.flatMap(ct => ct.tenants.map(t => t.tenant.id))).size}</p>
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
                  placeholder="Search collections..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-muted/30 border-none" 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredContentTypes.length === 0 ? (
                <div className="py-24 text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground text-sm uppercase">No collections defined</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-6 font-bold text-[10px] uppercase">Identity</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Fields</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Tenants</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">Status</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase text-center">API</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContentTypes.map((ct) => (
                      <TableRow 
                        key={ct.id} 
                        className="group hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/content-types/${ct.slug}`)}
                      >
                        <TableCell className="pl-6">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-foreground">{ct.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground uppercase">{ct.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-bold text-[10px] bg-muted/30">{ct.fields.length}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs font-medium text-muted-foreground">
                          {ct.tenants.length} tenants
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={ct.isPublished ? "default" : "secondary"}
                            className="text-[9px] font-black uppercase px-1.5 h-4"
                          >
                            {ct.isPublished ? "Live" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 font-black uppercase text-[9px] rounded-lg gap-1.5"
                            onClick={() => {
                              const url = `${window.location.origin}/api/public/content/${ct.slug}`
                              navigator.clipboard.writeText(url)
                              toast({ title: "API URL Copied", description: ct.slug })
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy URL
                          </Button>
                        </TableCell>
                        <TableCell className="text-right pr-6" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/admin/content-types/edit/${ct.id}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Schema
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive"
                                onClick={() => handleDeleteClick(ct)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Collection
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
                Content types created here are shared across all tenants. Changes to the schema will reflect globally.
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
              Permanently delete <strong>"{deleteDialog.contentType?.name}"</strong>? This will also remove data for ALL tenants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">
                Type <span className="text-foreground">{deleteDialog.contentType?.name}</span> to confirm
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
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, contentType: null })} className="rounded-xl h-11">Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deleteDialog.contentType?.name}
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
