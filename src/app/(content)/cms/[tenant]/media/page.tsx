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
    if (session?.user) {
      fetchMedia()
      fetchStorageUsage()
    }
  }, [tenantSlug, session])

  const filteredMedia = useMemo(() => {
    return media.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
  }, [media, search])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (loading) return <div className="min-h-[80vh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>

  return (
    <div className="p-6 lg:p-10 space-y-6">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-6 px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Media Library</h1>
            <p className="text-muted-foreground">Manage your images and documents</p>
          </div>
          <Button 
            className="bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white rounded-none border border-zinc-900 dark:border-zinc-100 h-11 px-6 font-bold transition-colors shadow-none"
            onClick={() => setIsLibraryOpen(true)}
            disabled={isLimitReached}
          >
            <Upload className="mr-2 h-4 w-4" /> Upload Media
          </Button>
        </div>
      </div>

      <Card className="border border-border shadow-none bg-card rounded-none">
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search media..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 bg-muted/30 border border-border h-11 rounded-none focus-visible:ring-orange-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Limit Warning Banner */}
      {isLimitReached && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-none p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-2 bg-destructive/25 text-destructive rounded-none shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-destructive">Workspace Storage Full</h4>
              <p className="text-xs text-muted-foreground">
                You have used <span className="font-semibold text-foreground">{formatFileSize(currentStorage)}</span> of your {" "}
                <span className="font-semibold text-foreground">{formatFileSize(storageLimit * 1024 * 1024)}</span> storage limit.
                Delete existing assets or upgrade your plan to upload more files.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/5 text-destructive text-xs h-8 shrink-0 rounded-none" asChild>
            <Link href={`/dashboard/${tenantSlug}/subscriptions`}>Upgrade Plan</Link>
          </Button>
        </div>
      )}

      {filteredMedia.length === 0 ? (
        <div className="py-24 text-center text-muted-foreground bg-card rounded-none border border-dashed border-border">
          <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-10 text-orange-500" />
          <p className="font-bold">No media assets found.</p>
          <Button variant="link" className="text-orange-500 hover:text-orange-600 font-bold" onClick={() => !isLimitReached && setIsLibraryOpen(true)} disabled={isLimitReached}>Upload your first asset</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((item) => (
            <Card key={item.id} className="group overflow-hidden border border-border shadow-none transition-all rounded-none bg-card">
              <div className="aspect-square relative bg-muted flex items-center justify-center overflow-hidden border-b border-border">
                {item.mimeType.startsWith('image/') ? (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <FileText className="h-10 w-10 text-muted-foreground opacity-20" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <Button size="icon" variant="secondary" className="h-8 w-8 rounded-none border border-border" onClick={() => window.open(item.url, '_blank')}>
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
