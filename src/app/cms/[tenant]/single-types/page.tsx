"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  FileText, Edit2, Eye, Loader2, ArrowLeft, 
  Layers, CheckCircle2, Clock, Search, X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SingleType {
  id: string
  name: string
  slug: string
  description: string | null
  fields: any[]
  publishedAt: string | null
  updatedAt: string
}

export default function CMSSingleTypesPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const fetchSingleTypes = async () => {
    if (!tenantSlug) return
    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/single-types`)
      if (response.ok) {
        const data = await response.json()
        setSingleTypes(data || [])
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Failed to load pages" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchSingleTypes()
  }, [tenantSlug, session])

  const filteredSingleTypes = useMemo(() => {
    return singleTypes.filter(st => 
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      st.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [singleTypes, searchTerm])

  if (loading && singleTypes.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cms/${tenantSlug}`)} className="rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors">
            <ArrowLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
          </Button>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">Static Pages</h1>
            <p className="text-muted-foreground font-medium mt-1">Update singleton content like Navbars, Footers, and Landing Pages.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search pages..." 
            className="pl-9 rounded-xl bg-card border border-border shadow-sm h-11 focus-visible:ring-emerald-500"
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
            <h3 className="text-xl font-bold text-foreground">No Pages Found</h3>
            <p className="text-muted-foreground max-w-xs mt-2 font-medium">
              {searchTerm ? `No results for "${searchTerm}"` : "You don't have any static pages to manage yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border shadow-sm overflow-hidden bg-card rounded-3xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="pl-8 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Page Name</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Slug</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Status</TableHead>
                  <TableHead className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">Last Updated</TableHead>
                  <TableHead className="text-right pr-8 font-black text-[10px] uppercase tracking-widest text-muted-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSingleTypes.map((st) => (
                  <TableRow 
                    key={st.id} 
                    className="group hover:bg-muted/5 transition-colors cursor-pointer border-b border-border/50 last:border-0"
                    onClick={() => router.push(`/cms/${tenantSlug}/single-types/${st.slug}`)}
                  >
                    <TableCell className="pl-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-500 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-500 transition-colors">{st.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px] font-medium">{st.description || 'Manage page content'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-[10px] font-bold bg-muted px-2 py-1 rounded-lg text-muted-foreground border border-border/50">/{st.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase border shadow-sm transition-colors",
                        st.publishedAt 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/50" 
                          : "bg-muted text-muted-foreground border-border"
                      )}>
                        <span className={cn("mr-1.5 h-1 w-1 rounded-full inline-block animate-pulse", st.publishedAt ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                        {st.publishedAt ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {new Date(st.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right pr-8">
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20 dark:shadow-none transition-all hover:scale-105 active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/cms/${tenantSlug}/single-types/${st.slug}`)
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1.5" /> Edit Content
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
