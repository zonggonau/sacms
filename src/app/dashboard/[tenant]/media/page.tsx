"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  File,
  Film,
  Music,
  Trash2,
  Download,
  Check,
  Grid,
  List,
  Search,
  Copy,
  ExternalLink,
  Folder,
  Save,
  ShieldCheck,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface MediaFile {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl?: string
  alt?: string
  caption?: string
  width?: number
  height?: number
  createdAt: string
}

export default function MediaLibraryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [media, setMedia] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([])
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mimeFilter, setMimeFilter] = useState<string>("all")
  
  // Edit Metadata State
  const [editData, setEditData] = useState({ name: "", alt: "", caption: "" })
  const [savingMetadata, setSavingMetadata] = useState(false)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  const fetchMedia = async () => {
    if (!tenantSlug) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media`)
      if (res.ok) {
        const data = await res.json()
        setMedia(data.media || [])
      }
    } catch (error) {
      console.error("Failed to fetch media:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchMedia()
  }, [tenantSlug, session])

  useEffect(() => {
    if (previewMedia) {
      setEditData({
        name: previewMedia.name,
        alt: previewMedia.alt || "",
        caption: previewMedia.caption || ""
      })
    }
  }, [previewMedia])

  const handleFileUpload = async (files: FileList) => {
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => {
        formData.append("files", file)
      })

      const res = await fetch(`/api/tenant/${tenantSlug}/media`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast({ title: "Success", description: "Files uploaded successfully" })
        fetchMedia()
      } else {
        const data = await res.json()
        toast({ variant: "destructive", title: "Upload Failed", description: data.error })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Network error during upload" })
    } finally {
      setUploading(false)
    }
  }

  const handleSaveMetadata = async () => {
    if (!previewMedia) return
    setSavingMetadata(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media/${previewMedia.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        toast({ title: "Metadata Updated" })
        setPreviewMedia(null)
        fetchMedia()
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save metadata" })
    } finally {
      setSavingMetadata(false)
    }
  }

  const handleDelete = async (mediaId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) return

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media/${mediaId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setMedia(media.filter((m) => m.id !== mediaId))
        setSelectedMedia(selectedMedia.filter((m) => m.id !== mediaId))
        if (previewMedia?.id === mediaId) setPreviewMedia(null)
        toast({ title: "File Deleted" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Delete failed" })
    }
  }

  const toggleSelect = (item: MediaFile) => {
    setSelectedMedia(prev => 
      prev.find(m => m.id === item.id) 
        ? prev.filter(m => m.id !== item.id) 
        : [...prev, item]
    )
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return ImageIcon
    if (mimeType.startsWith("video/")) return Film
    if (mimeType.startsWith("audio/")) return Music
    return File
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const filteredMedia = media.filter((item) => {
    const matchSearch = !searchQuery || item.originalName.toLowerCase().includes(searchQuery.toLowerCase())
    const matchMime = mimeFilter === "all" || item.mimeType.startsWith(mimeFilter)
    return matchSearch && matchMime
  })

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
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Media Library</h1>
                <p className="text-muted-foreground">{media.length} assets stored in this workspace</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="bg-card"
              >
                {viewMode === "grid" ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
              {selectedMedia.length > 0 && (
                <Button variant="destructive" onClick={() => {}}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete ({selectedMedia.length})
                </Button>
              )}
              <label>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <span className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Files
                  </span>
                </Button>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                />
              </label>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search assets by filename..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-card"
              />
            </div>
            <div className="flex bg-card p-1 rounded-xl border shadow-sm h-10">
              {["all", "image/", "video/", "application/"].map((filter) => {
                const labels: Record<string, string> = { "all": "All", "image/": "Images", "video/": "Videos", "application/": "Documents" }
                const active = mimeFilter === filter
                return (
                  <Button
                    key={filter}
                    variant="ghost"
                    size="sm"
                    onClick={() => setMimeFilter(filter)}
                    className={active ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground font-bold rounded-lg" : "text-xs"}
                  >
                    {labels[filter]}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Media Grid/List */}
          {filteredMedia.length === 0 ? (
            <Card className="border-dashed py-20 bg-card">
              <CardContent className="text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-lg font-bold">No assets found</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1 mb-6">
                  {searchQuery ? "Try adjusting your search query or filters." : "Start building your library by uploading images or documents."}
                </p>
                <label>
                  <Button asChild variant="outline">
                    <span className="cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" />
                      Initial Upload
                    </span>
                  </Button>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                </label>
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredMedia.map((item) => {
                const isSelected = selectedMedia.find((m) => m.id === item.id)
                const isImage = item.mimeType.startsWith("image/")

                return (
                  <div
                    key={item.id}
                    className={`group relative aspect-square border rounded-2xl overflow-hidden cursor-pointer transition-all bg-card ${
                      isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md border-transparent"
                    }`}
                    onClick={() => setPreviewMedia(item)}
                  >
                    {isImage ? (
                      <img
                        src={item.thumbnailUrl || item.url}
                        alt={item.alt || item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                        {(() => { const Icon = getFileIcon(item.mimeType); return <Icon className="h-10 w-10 text-muted-foreground/40" /> })()}
                        <span className="text-[10px] font-bold uppercase mt-2 text-muted-foreground/60">{item.mimeType.split('/')[1]}</span>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
                        >
                          {isSelected ? <Check className="h-4 w-4 text-primary" /> : <ImageIcon className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-8 w-8 rounded-full hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-white font-bold px-2 text-center truncate w-full">{item.originalName}</p>
                    </div>
                    
                    {/* Selection Dot */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <Card className="border-none shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="font-bold text-[11px] uppercase">Asset Name</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase">Format</TableHead>
                    <TableHead className="font-bold text-[11px] uppercase">Size</TableHead>
                    <TableHead className="text-right font-bold text-[11px] uppercase px-6">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card">
                  {filteredMedia.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/5 cursor-pointer" onClick={() => setPreviewMedia(item)}>
                      <TableCell>
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden border">
                          {item.mimeType.startsWith("image/") ? (
                            <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            (() => { const Icon = getFileIcon(item.mimeType); return <Icon className="h-5 w-5 text-muted-foreground" /> })()
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-bold text-sm">{item.originalName}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{item.mimeType}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground font-medium">{formatFileSize(item.size)}</TableCell>
                      <TableCell className="text-right px-6 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Asset Details & Metadata Editor */}
          <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
            <DialogContent className="sm:max-w-[800px] gap-0 p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
              <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                {/* Preview Left */}
                <div className="flex-1 bg-black flex items-center justify-center p-4 min-h-[300px]">
                  {previewMedia?.mimeType.startsWith("image/") ? (
                    <img
                      src={previewMedia.url}
                      alt={previewMedia.alt || previewMedia.name}
                      className="max-w-full max-h-full object-contain shadow-2xl rounded-sm"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-4 text-white/40">
                      {previewMedia && (() => { const Icon = getFileIcon(previewMedia.mimeType); return <Icon className="h-20 w-20" /> })()}
                      <p className="text-sm font-bold uppercase tracking-widest">{previewMedia?.mimeType}</p>
                    </div>
                  )}
                </div>

                {/* Sidebar Right */}
                <div className="w-full md:w-[320px] bg-card p-6 flex flex-col border-l">
                  <div className="flex-1 space-y-6 overflow-y-auto">
                    <div>
                      <h3 className="text-lg font-black tracking-tight truncate">{previewMedia?.originalName}</h3>
                      <p className="text-[10px] font-mono text-muted-foreground mt-1 opacity-60">ID: {previewMedia?.id}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Asset Display Name</Label>
                        <Input 
                          value={editData.name} 
                          onChange={e => setEditData({...editData, name: e.target.value})} 
                          className="h-9 bg-muted/30 border-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Alt Text (SEO)</Label>
                        <Input 
                          value={editData.alt} 
                          onChange={e => setEditData({...editData, alt: e.target.value})} 
                          placeholder="Describe for screen readers..."
                          className="h-9 bg-muted/30 border-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caption</Label>
                        <Textarea 
                          value={editData.caption} 
                          onChange={e => setEditData({...editData, caption: e.target.value})} 
                          placeholder="Optional image caption..."
                          className="bg-muted/30 border-none min-h-[80px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 border-t border-dashed">
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Format</p>
                        <p className="text-xs font-bold">{previewMedia?.mimeType.split('/')[1].toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Size</p>
                        <p className="text-xs font-bold">{previewMedia && formatFileSize(previewMedia.size)}</p>
                      </div>
                      {previewMedia?.width && (
                        <div>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Dimensions</p>
                          <p className="text-xs font-bold">{previewMedia.width} × {previewMedia.height}px</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Added</p>
                        <p className="text-xs font-bold">{previewMedia && new Date(previewMedia.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t space-y-2">
                    <Button className="w-full bg-primary hover:bg-primary/90" onClick={handleSaveMetadata} disabled={savingMetadata}>
                      {savingMetadata ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Save Changes
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1 h-9 text-xs" asChild>
                        <a href={previewMedia?.url} download target="_blank" rel="noreferrer">
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                        </a>
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-destructive hover:bg-destructive/5" onClick={() => previewMedia && handleDelete(previewMedia.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  )
}
