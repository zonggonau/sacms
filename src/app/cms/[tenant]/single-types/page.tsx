"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  FileText, Edit2, Eye, EyeOff, Save, 
  Loader2, ArrowLeft, Layers, CheckCircle2, Clock
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [loading, setLoading] = useState(true)

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
      toast({ variant: "destructive", title: "Error", description: "Failed to load static pages" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchSingleTypes()
  }, [tenantSlug, session])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/cms/${tenantSlug}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Static Pages</h1>
            <p className="text-muted-foreground">Manage single-entry content types (e.g. About, Contact)</p>
          </div>
        </div>
      </div>

      {singleTypes.length === 0 ? (
        <Card className="border-dashed border-2 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <Layers className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-bold">No Static Pages Found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              This workspace doesn't have any single-entry content types assigned yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-sm overflow-hidden bg-card rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6 font-bold text-[10px] uppercase tracking-widest">Page Name</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Identifier</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                  <TableHead className="font-bold text-[10px] uppercase tracking-widest">Last Modified</TableHead>
                  <TableHead className="text-right pr-6 font-bold text-[10px] uppercase tracking-widest">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {singleTypes.map((st) => (
                  <TableRow key={st.id} className="group hover:bg-muted/5 transition-colors">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                          <FileText className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{st.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{st.description || 'No description'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[10px] uppercase text-muted-foreground tracking-tight">
                      {st.slug}
                    </TableCell>
                    <TableCell>
                      {st.publishedAt ? (
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[9px] font-black uppercase">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Published
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[9px] font-black uppercase">
                          <Clock className="h-2.5 w-2.5 mr-1" /> Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {new Date(st.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
                        onClick={() => router.push(`/cms/${tenantSlug}/single-types/${st.slug}/edit`)}
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
