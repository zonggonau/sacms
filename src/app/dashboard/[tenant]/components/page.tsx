"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Plus, MoreVertical, Edit, Trash2, Box, Puzzle, 
  Globe, Layout, ArrowRight, Loader2, Search,
  Filter, CheckCircle2, AlertCircle, ShieldCheck,
  Package, Tags, Info
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { cn } from "@/lib/utils"

interface Component {
  id: string
  name: string
  slug: string
  description: string | null
  category: string | null
  fields: any[]
  isGlobal?: boolean
}

export default function ComponentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [componentToDelete, setComponentToDelete] = useState<Component | null>(null)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  const fetchComponents = async () => {
    if (!tenantSlug) return
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/components`)
      if (!response.ok) throw new Error("Failed to load components")
      const data = await response.json()
      setComponents(data || [])
    } catch (error) {
      console.error("Error fetching components:", error)
      toast({ variant: "destructive", title: "Error", description: "Could not load shared components" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchComponents()
  }, [tenantSlug, session])

  const filteredComponents = useMemo(() => {
    return components.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  }, [components, searchQuery])

  const handleDelete = async () => {
    if (!componentToDelete) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/components/${componentToDelete.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Delete failed")
      toast({ title: "Component Removed", description: `${componentToDelete.name} has been deleted.` })
      fetchComponents()
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete component" })
    } finally {
      setIsDeleting(false)
      setComponentToDelete(null)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
        <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
        <main className="flex-1 min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
              <h1 className="text-3xl font-extrabold tracking-tight">Components</h1>
              <p className="text-muted-foreground">Reusable data structures for nested content fields.</p>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
              asChild
            >
              <Link href={`/dashboard/${tenantSlug}/components/new`}>
                <Plus className="mr-2 h-4 w-4" /> Create Component
              </Link>
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Puzzle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Active</p>
                  <p className="text-xl font-black">{components.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                  <Tags className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Categories</p>
                  <p className="text-xl font-black">{new Set(components.map(c => c.category).filter(Boolean)).size}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-none shadow-sm">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">System Assets</p>
                  <p className="text-xl font-black">{components.filter(c => c.isGlobal).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & List */}
          <Card className="border-none shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-card border-b">
              <div className="relative max-w-sm w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search components or categories..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 h-9 bg-muted/30 border-none" 
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
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest pl-6">Component Identity</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest">Category</TableHead>
                      <TableHead className="font-bold text-[10px] uppercase tracking-widest text-center">Field Count</TableHead>
                      <TableHead className="text-right pr-6"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredComponents.map((component) => (
                      <TableRow key={component.id} className="group hover:bg-muted/5 transition-colors">
                        <TableCell className="pl-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100">
                              <Box className="h-4.5 w-4.5" />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-foreground">{component.name}</span>
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/${tenantSlug}/components/${component.slug}`}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Details
                                </Link>
                              </DropdownMenuItem>
                              {!component.isGlobal && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setComponentToDelete(component)}
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
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex gap-4 text-orange-800 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
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
      </main>

      {/* Delete Confirmation */}
      <AlertDialog open={!!componentToDelete} onOpenChange={() => setComponentToDelete(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase text-destructive tracking-tight">Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium">
              Are you sure you want to remove the component <strong>"{componentToDelete?.name}"</strong>? This will break any Content Types currently using this component. This action is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl h-10">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-10 font-bold"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Component
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
