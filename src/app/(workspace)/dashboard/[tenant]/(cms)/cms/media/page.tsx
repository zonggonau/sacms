"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Loader2, ImageIcon, Upload, Search, Trash2, 
  Download, Edit, MoreVertical, Grid, List,
  Filter, CheckCircle2, FileText, File, ExternalLink,
  ChevronRight, AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MediaLibraryDialog } from "@/components/media-library-dialog"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import Link from "next/link"

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

  // Storage usage states
  const [storageLimit, setStorageLimit] = useState<number>(0)
  const [currentStorage, setCurrentStorage] = useState<number>(0)
  const [isLimitReached, setIsLimitReached] = useState<boolean>(false)

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

  const fetchStorageUsage = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/billing/usage`)
      if (res.ok) {
        const data = await res.json()
        const storageUsage = data.usage?.find((u: any) => u.label === "Media Storage")
        if (storageUsage) {
          setStorageLimit(storageUsage.limit)
          setCurrentStorage(storageUsage.current)
          setIsLimitReached(storageUsage.current >= storageUsage.limit)
        }
      }
    } catch (error) {
      console.error("Failed to fetch storage usage:", error)
    }
  }

  useEffect(() => {
    if (session?.user?.id) {
      fetchMedia()
      fetchStorageUsage()
    }
  }, [tenantSlug, session?.user?.id])

  const filteredMedia = useMemo(() => {
    return media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  }, [media, search])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Media CMS</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
              {media.length} File
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola dan pilih aset gambar, video, dan dokumen untuk konten CMS Anda.
          </p>
        </div>
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-9 px-4 font-bold text-xs shadow-xs"
          onClick={() => setIsLibraryOpen(true)}
          disabled={isLimitReached}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" /> Unggah Media
        </Button>
      </div>

      {/* Search Input */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
        <CardContent className="p-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Cari file media..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/80 h-9 rounded-xl text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Limit Warning Banner */}
      {isLimitReached && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2 bg-destructive/20 text-destructive rounded-xl shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h4 className="font-bold text-xs text-destructive">Penyimpanan Media Penuh</h4>
              <p className="text-[11px] text-muted-foreground">
                Anda telah memakai <span className="font-bold text-foreground">{formatFileSize(currentStorage)}</span> dari kuota {" "}
                <span className="font-bold text-foreground">{formatFileSize(storageLimit * 1024 * 1024)}</span>. Hapus aset lama atau upgrade paket Anda.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive text-xs h-8 rounded-xl shrink-0 font-bold" asChild>
            <Link href={`/dashboard/${tenantSlug}/subscriptions`}>Upgrade Paket</Link>
          </Button>
        </div>
      )}

      {filteredMedia.length === 0 ? (
        <Card className="border border-dashed border-border/80 py-20 bg-card rounded-2xl shadow-xs text-center">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mb-3 border border-border/60">
              <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Tidak Ada Aset Media</h3>
            <p className="text-xs text-muted-foreground max-w-xs mt-1 mb-4">
              {search ? "Tidak ditemukan file yang cocok dengan pencarian." : "Belum ada file media yang diunggah ke workspace ini."}
            </p>
            <Button 
              variant="outline" 
              className="rounded-xl text-xs font-bold h-9 shadow-xs" 
              onClick={() => !isLimitReached && setIsLibraryOpen(true)} 
              disabled={isLimitReached}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Unggah Media Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="group overflow-hidden border border-border/80 shadow-xs hover:shadow-md transition-all rounded-2xl bg-card">
              <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden border-b border-border/60">
                {item.mimeType?.startsWith('image/') ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground/40" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full shadow-xs" onClick={() => window.open(item.url, '_blank')}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold truncate text-foreground">{item.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatFileSize(item.size)}</p>
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
