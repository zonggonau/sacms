"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Loader2, ImageIcon, Upload, Search, Trash2, 
  Download, Edit, MoreVertical, Grid, List,
  Filter, CheckCircle2, FileText, File, ExternalLink,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { toast } from "@/hooks/use-toast"

interface MediaFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  mimeType: string
  createdAt: string
}

export default function CMSMediaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  
  const [media, setMedia] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)

  const fetchMedia = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media`)
      if (res.ok) {
        const data = await res.json()
        setMedia(data.media || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchMedia()
  }, [tenantSlug, session])

  const filteredMedia = useMemo(() => {
    return media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  }, [media, search])

  if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Media Library</h1>
          <p className="text-muted-foreground">Manage your images and documents</p>
        </div>
        <Button 
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg"
          onClick={() => setIsLibraryOpen(true)}
        >
          <Upload className="mr-2 h-4 w-4" /> Upload Media
        </Button>
      </div>

      <Card className="border-none shadow-sm bg-card">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search media..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 border-none h-10"
            />
          </div>
        </CardContent>
      </Card>

      {filteredMedia.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground bg-card rounded-3xl border-2 border-dashed">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-10" />
          <p className="font-bold">No media assets found.</p>
          <Button variant="link" className="text-emerald-600" onClick={() => setIsLibraryOpen(true)}>Upload your first asset</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all rounded-2xl bg-card">
              <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden">
                {item.mimeType.startsWith('image/') ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground opacity-20" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" onClick={() => window.open(item.url, '_blank')}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-bold truncate text-foreground">{item.name}</p>
                <p className="text-[8px] text-muted-foreground uppercase font-black tracking-widest mt-1">{(item.size / 1024).toFixed(1)} KB</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <MediaLibraryDialog 
        open={isLibraryOpen} 
        onOpenChange={setIsLibraryOpen} 
        tenantSlug={tenantSlug} 
        onSelect={() => fetchMedia()} 
      />
    </div>
  )
}
