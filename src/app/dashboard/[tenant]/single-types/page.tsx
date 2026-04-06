"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { 
  Save, Eye, EyeOff, FileText, Plus, Edit2, 
  Trash2, Loader2, Sparkles, Search, X, 
  ChevronRight, Calendar, Layers, Globe
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
  const [tenantSlug, setTenantSlug] = useState<string>("")
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const tenants = session?.user?.tenants || []
  const isSuperAdmin = session?.user?.role === "super_admin"

  const fetchSingleTypes = useCallback(async (tenant: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tenant/${tenant}/single-types`)
      if (response.status === 403 || response.status === 404) {
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
      setTenantSlug(tenant)
      await fetchSingleTypes(tenant)
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
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`, {
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

      await fetchSingleTypes(tenantSlug)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${publish ? 'publish' : 'unpublish'}`,
      })
    }
  }

  const handleDelete = async (singleType: SingleType) => {
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types/${singleType.id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete")

      toast({
        title: "Deleted",
        description: `${singleType.name} has been removed.`,
      })

      await fetchSingleTypes(tenantSlug)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete single type",
      })
    }
  }

  if (loading && singleTypes.length === 0) {
    return (
      <div className="flex min-h-screen bg-muted/10">
        <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-slate-900">Single Types</h1>
              <p className="text-muted-foreground mt-1 font-medium">
                Manage your singleton content structures and data.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                className="rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold px-6 shadow-sm"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Sparkles className="mr-2 h-4 w-4" /> AI Generate
              </Button>
              <Button 
                className="rounded-xl bg-primary hover:bg-primary/90 font-bold px-6 shadow-lg shadow-primary/20"
                onClick={() => router.push(`/dashboard/${tenantSlug}/single-types/new`)}
              >
                <Plus className="mr-2 h-4 w-4" /> New Single Type
              </Button>
            </div>
          </div>

          {/* Stats/Quick Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-sm bg-card rounded-2xl">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Types</p>
                  <p className="text-2xl font-bold">{singleTypes.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-card rounded-2xl">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Published</p>
                  <p className="text-2xl font-bold">{singleTypes.filter(s => s.publishedAt).length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm bg-card rounded-2xl">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Drafts</p>
                  <p className="text-2xl font-bold">{singleTypes.filter(s => !s.publishedAt).length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table Control Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search single types..." 
                className="pl-9 rounded-xl bg-card border-none shadow-sm h-11"
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

          {filteredSingleTypes.length === 0 ? (
            <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden py-20">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-3xl bg-muted/30 flex items-center justify-center mb-6">
                  <FileText className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-xl font-bold text-slate-900">No Single Types Found</h3>
                <p className="text-muted-foreground max-w-xs mt-2 font-medium">
                  {searchTerm ? `No results for "${searchTerm}". Try another keyword.` : "Start by creating a new structure for your singleton content."}
                </p>
                {!searchTerm && (
                  <Button 
                    className="mt-8 rounded-xl font-bold"
                    onClick={() => setIsAIModalOpen(true)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest">Structure Name</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">API Slug</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Field Count</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Status</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest">Last Updated</TableHead>
                      <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSingleTypes.map((st) => (
                      <TableRow key={st.id} className="group hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/${tenantSlug}/single-types/${st.slug}/edit`)}>
                        <TableCell className="pl-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary group-hover:text-white transition-all">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">{st.name}</span>
                                {st.isGlobal && <Badge variant="outline" className="text-[8px] uppercase font-black px-1.5 h-4 border-primary/20 text-primary">Global</Badge>}
                              </div>
                              {st.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{st.description}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="text-[11px] font-bold bg-slate-100 px-2 py-1 rounded-lg text-slate-600">/{st.slug}</code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <Layers className="h-3.5 w-3.5 opacity-40" />
                            {st.fields.length}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase border",
                              st.publishedAt 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            <span className={cn("mr-1.5 h-1 w-1 rounded-full inline-block", st.publishedAt ? "bg-emerald-500" : "bg-slate-400")} />
                            {st.publishedAt ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <Calendar className="h-3.5 w-3.5 opacity-40" />
                            {st.updatedAt ? new Date(st.updatedAt).toLocaleDateString() : "Never"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            {/* Edit Content Button */}
                            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-primary/10 hover:text-primary" asChild>
                              <Link href={`/dashboard/${tenantSlug}/single-types/${st.slug}`}>
                                <Edit2 className="h-4 w-4" />
                              </Link>
                            </Button>

                            {/* Schema Button */}
                            {(!st.isGlobal || isSuperAdmin) && (
                              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-blue-50 hover:text-blue-600" asChild title="Edit Schema">
                                <Link href={`/dashboard/${tenantSlug}/single-types/${st.slug}/edit`}>
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </Button>
                            )}

                            {/* Toggle Publish Button */}
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn(
                                "rounded-full h-9 w-9",
                                st.publishedAt ? "hover:bg-amber-50 hover:text-amber-600" : "hover:bg-emerald-50 hover:text-emerald-600"
                              )}
                              onClick={() => handlePublishToggle(st, !st.publishedAt)}
                              title={st.publishedAt ? "Unpublish" : "Publish Now"}
                            >
                              {st.publishedAt ? <EyeOff className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                            </Button>

                            {/* Delete Button */}
                            {(!st.isGlobal || isSuperAdmin) && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-2xl font-black">Delete {st.name}?</AlertDialogTitle>
                                    <AlertDialogDescription className="font-medium">
                                      This will permanently remove the structure and all its content from this workspace.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="mt-4 gap-3">
                                    <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(st)}
                                      className="bg-red-600 text-white hover:bg-red-700 rounded-xl font-bold"
                                    >
                                      Confirm Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <SchemaGeneratorDialog
        tenantSlug={tenantSlug}
        type="single-type"
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        onSuccess={() => fetchSingleTypes(tenantSlug)}
      />
    </div>
  )
}
