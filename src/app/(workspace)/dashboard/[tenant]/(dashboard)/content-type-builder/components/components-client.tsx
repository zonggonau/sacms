"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { 
  Plus, MoreVertical, Edit, Trash2, Box, Puzzle, 
  Search, Info, Sparkles, Package, Tags, Loader2, AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
import { deleteComponentAction } from "@/actions/components"
import { useRouter } from "next/navigation"

interface Component {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  fields: any[]
  isGlobal?: boolean
  usedByCount?: number
}

interface ComponentsClientProps {
  initialComponents: Component[]
  tenantSlug: string
  limit?: number
  current?: number
}

export function ComponentsClient({ initialComponents, tenantSlug, limit = 3, current = 0 }: ComponentsClientProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)

  const filteredComponents = useMemo(() => {
    return initialComponents.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [initialComponents, searchQuery])

  const isLimitReached = useMemo(() => {
    return current >= limit
  }, [current, limit])

  const handleDeleteClick = (component: Component) => {
    setComponentToDelete(component)
    setDeleteConfirmName("")
  }

  const handleDelete = async () => {
    if (!componentToDelete) return
    if (deleteConfirmName !== componentToDelete.name) {
      toast({ variant: "destructive", title: "Error", description: "Verification name does not match" })
      return
    }

    setIsDeleting(true)
    try {
      const response = await deleteComponentAction(tenantSlug, componentToDelete.id)
      if (response.error) throw new Error(response.error)
      toast({ title: "Component Removed", description: `${componentToDelete.name} has been deleted.` })
      router.refresh()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete component" })
    } finally {
      setIsDeleting(false)
      setComponentToDelete(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-[#f6f6f9] text-foreground flex flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-800">Components</h1>
              <p className="text-xs text-slate-500 font-medium mt-1">Reusable data structures for nested content fields.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-none"
                onClick={() => setIsAIModalOpen(true)}
                disabled={isLimitReached}
              >
                <Sparkles className="mr-2 h-4 w-4" /> AI Generate
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-white font-bold rounded-none shadow-none"
                disabled={isLimitReached}
                asChild={!isLimitReached}
              >
                {isLimitReached ? (
                  <span>
                    <Plus className="mr-2 h-4 w-4" /> Create Component
                  </span>
                ) : (
                  <Link href={`/dashboard/${tenantSlug}/content-type-builder/components/new`}>
                    <Plus className="mr-2 h-4 w-4" /> Create Component
                  </Link>
                )}
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-primary/10 flex items-center justify-center text-primary">
                  <Puzzle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Active</p>
                  <p className="text-xl font-black">{initialComponents.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-orange-100 flex items-center justify-center text-orange-600">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categories</p>
                  <p className="text-xl font-black">{new Set(initialComponents.map(c => c.category).filter(Boolean)).size}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-none bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">System Assets</p>
                  <p className="text-xl font-black">{initialComponents.filter(c => c.isGlobal).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Limit Alert */}
          {isLimitReached && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-none p-4 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
              <div className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                You have reached your content structures limit of {limit} schemas. Delete an existing custom schema or upgrade your plan to create more.
              </div>
            </div>
          )}

          {/* Search & List */}
          <Card className="border border-slate-200 shadow-sm overflow-hidden bg-white rounded-none">
            <CardHeader className="bg-white border-b border-slate-200">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search components or categories..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 bg-white border border-slate-200 rounded-none shadow-sm focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary text-sm font-medium" 
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredComponents.length === 0 ? (
                <div className="py-24 text-center">
                  <Puzzle className="h-12 w-12 mx-auto mb-4 opacity-5" />
                  <p className="font-bold text-muted-foreground">No components found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Components help you build complex nested data structures.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-[#f6f6f9] border-b border-slate-200">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 pl-6">Component Identity</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Category</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Field Count</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComponents.map((component) => (
                      <TableRow key={component.id} className="group hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-none bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                              <Box className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <Link 
                                  href={`/dashboard/${tenantSlug}/content-type-builder/components/${component.slug}`}
                                  className="text-sm font-bold text-foreground hover:text-primary transition-colors"
                                >
                                  {component.name}
                                </Link>
                                {component.usedByCount !== undefined && component.usedByCount > 0 && (
                                  <Badge variant="outline" className="text-[9px] h-4 bg-amber-50 text-amber-700 border-amber-200">Used {component.usedByCount}x</Badge>
                                )}
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground uppercase">{component.slug}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {component.category ? (
                            <Badge variant="outline" className="text-[10px] font-bold uppercase bg-muted/30">{component.category}</Badge>
                          ) : (
                            <span className="text-[10px] italic text-muted-foreground opacity-50">uncategorized</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-black text-[10px] bg-muted">{component.fields.length}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/${tenantSlug}/content-type-builder/components/${component.slug}`}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Schema
                                </Link>
                              </DropdownMenuItem>
                              {!component.isGlobal && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDeleteClick(component)}
                                  >
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

          {/* Guidelines Banner */}
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-none flex gap-4 text-orange-800 shadow-none">
            <div className="w-10 h-10 rounded-none bg-orange-100 flex items-center justify-center shrink-0">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-widest">About Components</p>
              <p className="text-[11px] leading-relaxed mt-1 opacity-80 max-w-2xl">
                Components are shared data structures that can be reused across different Content Types. They allow you to define a group of fields once and embed them multiple times, perfect for SEO blocks, address formats, or page sections.
              </p>
            </div>
          </div>
        </div>
      </div>

      <SchemaGeneratorDialog
        tenantSlug={tenantSlug}
        type="component"
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        onSuccess={() => { router.refresh() }}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!componentToDelete} onOpenChange={(open) => {
        if (!open) setComponentToDelete(null)
      }}>
        <DialogContent className="rounded-none border-none shadow-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-black uppercase text-destructive tracking-tight flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-sm font-medium">
              Are you sure you want to remove the component <strong>"{componentToDelete?.name}"</strong>? This will break any Content Types currently using this component. This action is permanent.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {componentToDelete?.usedByCount !== undefined && componentToDelete.usedByCount > 0 && (
              <div className="p-4 bg-amber-50 rounded-none border border-amber-200">
                <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-amber-800">!</span>
                  Warning: Component in Use
                </p>
                <p className="text-xs text-amber-700 mt-2">
                  This component is currently used in <strong>{componentToDelete.usedByCount}</strong> field(s) across your schemas. Deleting it will cause data loss and errors in those fields.
                </p>
              </div>
            )}
            <div className="p-4 bg-destructive/10 rounded-none border border-destructive/20">
              <p className="text-xs font-bold text-destructive">To confirm, type the exact name of the component below:</p>
              <p className="text-sm font-black mt-1 text-destructive">{componentToDelete?.name}</p>
            </div>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder="Confirm component name"
              className="bg-muted/30 border-none h-10"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-none h-10" onClick={() => setComponentToDelete(null)}>Cancel</Button>
            <Button 
              variant="destructive"
              className="rounded-none h-10 font-bold"
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName !== componentToDelete?.name}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Component
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
