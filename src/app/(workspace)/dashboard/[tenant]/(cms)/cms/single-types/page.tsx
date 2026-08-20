"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  FileText, Edit2, Loader2, ArrowLeft, 
  Search, X
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
import { getSingleTypesAction } from "@/actions/single-types"

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
      const response = await getSingleTypesAction(tenantSlug)
      if (response.singleTypes) {
        setSingleTypes(response.singleTypes)
      } else if (response.error) {
        toast({ variant: "destructive", title: "Error", description: response.error })
      }
    } catch (error) {
      console.error(error)
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat daftar halaman" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.id) fetchSingleTypes()
  }, [tenantSlug, session?.user?.id])

  const filteredSingleTypes = useMemo(() => {
    return singleTypes.filter(st => 
      st.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      st.slug.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [singleTypes, searchTerm])

  if (loading && singleTypes.length === 0) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/${tenantSlug}/cms`)} className="rounded-xl h-9 w-9">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">Halaman Statis</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                {singleTypes.length} Tipe
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Kelola konten singleton seperti Beranda, Footer, dan Tentang Kami.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input 
            placeholder="Cari halaman statis..." 
            className="pl-9 rounded-xl bg-card border-border/80 h-9 text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {filteredSingleTypes.length === 0 ? (
        <Card className="border border-dashed border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden py-16 text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl border border-border/60 bg-muted/60 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Tidak Ada Halaman Ditemukan</h3>
            <p className="text-xs text-muted-foreground max-w-xs mt-1">
              {searchTerm ? `Tidak ada hasil untuk "${searchTerm}"` : "Belum ada skema Single Type yang dibuat pada workspace ini."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-border/80 shadow-xs overflow-hidden bg-card rounded-2xl">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/60">
                  <TableHead className="pl-5 font-bold text-xs uppercase">Nama Halaman</TableHead>
                  <TableHead className="font-bold text-xs uppercase">Slug Rute</TableHead>
                  <TableHead className="font-bold text-xs uppercase">Status</TableHead>
                  <TableHead className="font-bold text-xs uppercase">Terakhir Diperbarui</TableHead>
                  <TableHead className="text-right pr-5 font-bold text-xs uppercase">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSingleTypes.map((st) => (
                  <TableRow 
                    key={st.id} 
                    className="hover:bg-muted/20 transition-colors cursor-pointer border-b border-border/40 last:border-0"
                    onClick={() => router.push(`/dashboard/${tenantSlug}/cms/single-types/${st.slug}`)}
                  >
                    <TableCell className="pl-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-foreground">{st.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">{st.description || 'Kelola konten halaman'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-[10px] font-mono font-bold bg-muted/60 px-2 py-0.5 rounded-lg text-muted-foreground border border-border/60">/{st.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(
                        "rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase border shadow-none",
                        st.publishedAt 
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
                          : "bg-muted text-muted-foreground border-border/60"
                      )}>
                        <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full inline-block", st.publishedAt ? "bg-emerald-500" : "bg-muted-foreground/50")} />
                        {st.publishedAt ? "Terbit" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {new Date(st.updatedAt).toLocaleDateString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right pr-5">
                      <Button 
                        size="sm" 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-8 rounded-xl shadow-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/${tenantSlug}/cms/single-types/${st.slug}`)
                        }}
                      >
                        <Edit2 className="h-3 w-3 mr-1.5" /> Edit Konten
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
