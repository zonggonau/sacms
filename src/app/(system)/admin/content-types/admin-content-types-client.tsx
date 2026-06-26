"use client"

import { useState, useMemo, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, MoreVertical, Edit, Trash2, FileText, Database,
  Globe, Layout, Loader2, Search, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
import { useToast } from "@/hooks/use-toast"
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
import { deleteAdminContentTypeAction, seedAdminTemplatesAction } from "@/actions/admin-content-types"

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

interface AdminContentTypesClientProps {
  initialContentTypes: ContentType[]
}

export function AdminContentTypesClient({ initialContentTypes }: AdminContentTypesClientProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const [searchQuery, setSearchQuery] = useState("")
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)

  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; contentType: ContentType | null }>({
    open: false,
    contentType: null,
  })
  const [deleteConfirmName, setDeleteConfirmName] = useState("")

  const filteredTypes = useMemo(() => {
    return initialContentTypes.filter(ct =>
      ct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ct.slug.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [initialContentTypes, searchQuery])


  const handleDeleteClick = (contentType: ContentType) => {
    setDeleteDialog({ open: true, contentType })
    setDeleteConfirmName("")
  }

  const handleDelete = () => {
    if (!deleteDialog.contentType) return
    if (deleteConfirmName !== deleteDialog.contentType.name) {
      toast({ variant: "destructive", title: "Error", description: "Verification name does not match" })
      return
    }

    startTransition(async () => {
      const res = await deleteAdminContentTypeAction(deleteDialog.contentType!.id)
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Success", description: "Content type removed" })
        setDeleteDialog({ open: false, contentType: null })
      }
    })
  }

  const handleSeed = () => {
    startTransition(async () => {
      const res = await seedAdminTemplatesAction()
      if (res.error) {
        toast({ variant: "destructive", title: "Error", description: res.error })
      } else {
        toast({ title: "Success", description: `Seeded ${res.seededCount} templates.` })
      }
    })
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-[#f6f6f9] text-foreground flex flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Content Schemas</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Manage data structures and collection definitions.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-none shadow-sm border-slate-200"
                onClick={handleSeed}
                disabled={isPending}
              >
                <Database className="mr-2 h-4 w-4" /> Seed Templates
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white font-bold rounded-none shadow-none"
                onClick={() => router.push(`/admin/content-types/new`)}
              >
                <Plus className="mr-2 h-4 w-4" /> Create New Schema
              </Button>
            </div>
          </div>

          {/* Schema Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                  <Layout className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Schemas</p>
                  <p className="text-xl font-black">{initialContentTypes.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-blue-100 flex items-center justify-center text-blue-600">
                  <Globe className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Global Library</p>
                  <p className="text-xl font-black">{initialContentTypes.filter(c => c.isGlobal).length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Workspace Custom</p>
                  <p className="text-xl font-black">
                    {initialContentTypes.filter(c => !c.isGlobal).length}
                  </p>
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
                    placeholder="Filter schemas..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm font-medium"
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
                  <TableHeader className="bg-[#f6f6f9] border-b border-slate-200">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 pl-6">Structure Name</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Source</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Fields</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Data Entries</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Status</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTypes.map((ct) => (
                      <TableRow
                        key={ct.id}
                        className="group hover:bg-muted/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/admin/content-types/edit/${ct.slug}`)}
                      >
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-none bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
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
                        <TableCell className="text-center font-bold text-xs">{ct.fields?.length || 0}</TableCell>
                        <TableCell className="text-center font-bold text-xs">
                          <Badge variant="secondary" className="font-black text-[10px] bg-muted">{ct.entryCount?.toLocaleString() || 0}</Badge>
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => router.push(`/admin/content-types/edit/${ct.slug}`)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit Schema
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => router.push(`/admin/content/${ct.slug}`)}>
                                <Layout className="mr-2 h-4 w-4" /> Browse Entries
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDeleteClick(ct)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete Schema
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
        </div>
      </div>



      <Dialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, contentType: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Delete Content Type
            </DialogTitle>
            <DialogDescription className="pt-2">
              This action cannot be undone. This will permanently delete the
              <span className="font-bold text-foreground mx-1">
                {deleteDialog.contentType?.name}
              </span>
              content type and all its entries.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md font-medium">
              Warning: All data associated with this content type will be lost forever.
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Please type <span className="font-bold">{deleteDialog.contentType?.name}</span> to confirm.
              </label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Type name here"
                className="col-span-3"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, contentType: null })}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmName !== deleteDialog.contentType?.name || isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Content Type"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
