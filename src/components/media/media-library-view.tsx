"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Save,
  AlertTriangle,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export interface MediaFile {
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

interface MediaLibraryViewProps {
  tenantSlug?: string
  title?: string
  description?: string
}

export function MediaLibraryView({ 
  tenantSlug: propTenantSlug,
  title = "Pustaka Media",
  description
}: MediaLibraryViewProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = propTenantSlug || (params?.tenant as string)
  const { toast } = useToast()

  const [media, setMedia] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([])
  const [previewMedia, setPreviewMedia] = useState<MediaFile | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [mimeFilter, setMimeFilter] = useState<string>("all")
  
  // Storage usage states
  const [storageLimit, setStorageLimit] = useState<number>(0)
  const [currentStorage, setCurrentStorage] = useState<number>(0)
  const [isLimitReached, setIsLimitReached] = useState<boolean>(false)

  // Edit Metadata State
  const [editData, setEditData] = useState({ name: "", alt: "", caption: "" })
  const [savingMetadata, setSavingMetadata] = useState(false)

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

  useEffect(() => {
    if (previewMedia) {
      setEditData({
        name: previewMedia.name || previewMedia.originalName || "",
        alt: previewMedia.alt || "",
        caption: previewMedia.caption || "",
      })
    }
  }, [previewMedia])

  const handleFileUpload = async (files: FileList) => {
    if (files.length === 0) return
    setUploading(true)

    const formData = new FormData()
    Array.from(files).forEach((file) => {
      formData.append("files", file)
    })

    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        toast({ title: "Berhasil Diunggah", description: "File media telah berhasil diunggah" })
        fetchMedia()
        fetchStorageUsage()
      } else {
        const err = await res.json()
        toast({ variant: "destructive", title: "Gagal Unggah", description: err.error || "Terjadi kesalahan saat mengunggah" })
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({ variant: "destructive", title: "Koneksi Error", description: "Gagal menghubungi server" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus media ini? Tindakan ini tidak dapat dibatalkan.")) return
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/media/${id}`, {
        method: "DELETE",
      })

      if (res.ok) {
        toast({ title: "Media Dihapus", description: "File telah dihapus dari workspace" })
        setMedia(media.filter((m) => m.id !== id))
        if (previewMedia?.id === id) setPreviewMedia(null)
        fetchStorageUsage()
      } else {
        toast({ variant: "destructive", title: "Gagal Hapus", description: "Tidak dapat menghapus file media" })
      }
    } catch (error) {
      console.error("Delete error:", error)
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
        toast({ title: "Perubahan Disimpan", description: "Metadata aset berhasil diperbarui" })
        setMedia(media.map(m => m.id === previewMedia.id ? { ...m, ...editData } : m))
        setPreviewMedia({ ...previewMedia, ...editData })
      } else {
        toast({ variant: "destructive", title: "Gagal Menyimpan", description: "Tidak dapat memperbarui metadata" })
      }
    } catch (error) {
      console.error("Save metadata error:", error)
    } finally {
      setSavingMetadata(false)
    }
  }

  const toggleSelect = (item: MediaFile) => {
    if (selectedMedia.find((m) => m.id === item.id)) {
      setSelectedMedia(selectedMedia.filter((m) => m.id !== item.id))
    } else {
      setSelectedMedia([...selectedMedia, item])
    }
  }

  const filteredMedia = useMemo(() => {
    return media.filter((m) => {
      const matchesSearch = (m.originalName || m.name).toLowerCase().includes(searchQuery.toLowerCase())
      const matchesMime = mimeFilter === "all" || m.mimeType.startsWith(mimeFilter)
      return matchesSearch && matchesMime
    })
  }, [media, searchQuery, mimeFilter])

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const getFileIcon = (mime: string) => {
    if (mime.startsWith("image/")) return ImageIcon
    if (mime.startsWith("video/")) return Film
    if (mime.startsWith("audio/")) return Music
    return File
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex-1 min-h-[60vh] flex items-center justify-center flex-col w-full bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                {media.length} Aset
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description || (
                storageLimit > 0 ? (
                  <>Terpakai {formatFileSize(currentStorage)} dari kuota {formatFileSize(storageLimit)}</>
                ) : (
                  <>Kelola dan unggah aset gambar, video, dan dokumen workspace.</>
                )
              )}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-card border border-border/80 rounded-xl p-0.5 shadow-xs">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <Grid className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("list")}
                className="h-8 w-8 rounded-lg cursor-pointer"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            {selectedMedia.length > 0 && (
              <Button variant="destructive" size="sm" className="rounded-xl font-bold text-xs h-9" onClick={() => {}}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Hapus ({selectedMedia.length})
              </Button>
            )}

            <label>
              <Button 
                disabled={isLimitReached || uploading} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 rounded-xl shadow-xs cursor-pointer disabled:cursor-not-allowed"
                asChild={!isLimitReached && !uploading}
              >
                {isLimitReached || uploading ? (
                  <span className="flex items-center">
                    {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    Unggah File
                  </span>
                ) : (
                  <span className="cursor-pointer flex items-center">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    Unggah File
                  </span>
                )}
              </Button>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                className="hidden"
                disabled={isLimitReached || uploading}
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
            </label>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari aset berdasarkan nama file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 bg-card border-border/80 rounded-xl text-xs"
            />
          </div>
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/80 h-9 items-center gap-1">
            {["all", "image/", "video/", "application/"].map((filter) => {
              const labels: Record<string, string> = { "all": "Semua", "image/": "Gambar", "video/": "Video", "application/": "Dokumen" }
              const active = mimeFilter === filter
              return (
                <Button
                  key={filter}
                  variant="ghost"
                  size="sm"
                  onClick={() => setMimeFilter(filter)}
                  className={cn(
                    "h-7 rounded-lg text-xs font-semibold px-3 transition-all cursor-pointer",
                    active ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {labels[filter]}
                </Button>
              )
            })}
          </div>
        </div>

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
                  <span className="font-bold text-foreground">{formatFileSize(storageLimit)}</span>. Hapus aset lama atau upgrade paket Anda.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="border-destructive/30 hover:bg-destructive/10 text-destructive text-xs h-8 rounded-xl shrink-0 font-bold" asChild>
              <Link href={`/dashboard/${tenantSlug}/subscriptions`}>Upgrade Paket</Link>
            </Button>
          </div>
        )}

        {/* Media Grid/List */}
        {filteredMedia.length === 0 ? (
          <Card className="border border-dashed border-border/80 py-20 bg-card rounded-2xl shadow-xs">
            <CardContent className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 border border-border/60">
                <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Tidak Ada Aset Ditemukan</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 mb-5">
                {searchQuery ? "Sesuaikan kata kunci pencarian atau filter Anda." : "Mulai bangun galeri media dengan mengunggah gambar atau dokumen."}
              </p>
              <label>
                <Button 
                  disabled={isLimitReached || uploading} 
                  variant="outline"
                  className="rounded-xl text-xs font-bold h-9 shadow-xs cursor-pointer"
                  asChild={!isLimitReached && !uploading}
                >
                  {isLimitReached || uploading ? (
                    <span className="flex items-center">
                      {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                      Unggah Media Pertama
                    </span>
                  ) : (
                    <span className="cursor-pointer flex items-center">
                      <Upload className="mr-1.5 h-3.5 w-3.5" />
                      Unggah Media Pertama
                    </span>
                  )}
                </Button>
                <input
                  type="file"
                  multiple
                  className="hidden"
                  disabled={isLimitReached || uploading}
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
                  className={`group relative aspect-square border border-border/80 rounded-2xl overflow-hidden cursor-pointer transition-all bg-card shadow-xs hover:shadow-md ${
                    isSelected ? "ring-2 ring-primary shadow-md" : ""
                  }`}
                  onClick={() => setPreviewMedia(item)}
                >
                  {isImage ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.alt || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30 p-2 text-center">
                      {(() => { const Icon = getFileIcon(item.mimeType); return <Icon className="h-8 w-8 text-muted-foreground/40 mb-1" /> })()}
                      <span className="text-[10px] font-bold uppercase text-muted-foreground truncate w-full">{item.mimeType.split('/')[1]}</span>
                    </div>
                  )}
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <div className="flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 rounded-full cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item) }}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5 text-primary" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:text-destructive cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-white font-bold px-1 text-center truncate w-full">{item.originalName}</p>
                  </div>
                  
                  {/* Selection Dot */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-xs">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <Card className="border border-border/80 shadow-xs rounded-2xl overflow-hidden bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border/60">
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="font-bold text-xs uppercase">Nama File</TableHead>
                  <TableHead className="font-bold text-xs uppercase">Format</TableHead>
                  <TableHead className="font-bold text-xs uppercase">Ukuran</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase px-4">Diunggah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMedia.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/20 cursor-pointer border-b border-border/40" onClick={() => setPreviewMedia(item)}>
                    <TableCell className="py-2.5">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center overflow-hidden border border-border/60">
                        {item.mimeType.startsWith("image/") ? (
                          <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (() => { const Icon = getFileIcon(item.mimeType); return <Icon className="h-4 w-4 text-muted-foreground" /> })()
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-foreground">{item.originalName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] rounded-full">{item.mimeType}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{formatFileSize(item.size)}</TableCell>
                    <TableCell className="text-right px-4 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString('id-ID')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Asset Details & Metadata Editor Modal */}
        <Dialog open={!!previewMedia} onOpenChange={() => setPreviewMedia(null)}>
          <DialogContent className="sm:max-w-[760px] gap-0 p-0 overflow-hidden rounded-2xl border-border/80 shadow-xl bg-card">
            <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
              {/* Preview Left */}
              <div className="flex-1 bg-black/90 flex items-center justify-center p-4 min-h-[260px]">
                {previewMedia?.mimeType.startsWith("image/") ? (
                  <img
                    src={previewMedia.url}
                    alt={previewMedia.alt || previewMedia.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                ) : previewMedia?.mimeType === "application/pdf" ? (
                  <iframe
                    src={`${previewMedia.url}#toolbar=0`}
                    className="w-full h-full min-h-[450px] border-none bg-card rounded-lg"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-white/40">
                    {previewMedia && (() => { const Icon = getFileIcon(previewMedia.mimeType); return <Icon className="h-16 w-16" /> })()}
                    <p className="text-xs font-bold uppercase tracking-wider">{previewMedia?.mimeType}</p>
                  </div>
                )}
              </div>

              {/* Sidebar Right */}
              <div className="w-full md:w-[320px] bg-card p-5 flex flex-col border-l border-border/60">
                <DialogHeader className="sr-only">
                  <DialogTitle>Detail Media: {previewMedia?.originalName}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                  <div>
                    <h3 className="text-sm font-bold tracking-tight truncate text-foreground">{previewMedia?.originalName}</h3>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5 opacity-70 truncate">ID: {previewMedia?.id}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Tampilan Aset</Label>
                      <Input 
                        value={editData.name} 
                        onChange={e => setEditData({...editData, name: e.target.value})} 
                        className="h-8 bg-muted/30 border-border/80 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Alt Text (SEO & Aksesibilitas)</Label>
                      <Input 
                        value={editData.alt} 
                        onChange={e => setEditData({...editData, alt: e.target.value})} 
                        placeholder="Deskripsi untuk screen reader..."
                        className="h-8 bg-muted/30 border-border/80 rounded-xl text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Keterangan (Caption)</Label>
                      <Textarea 
                        value={editData.caption} 
                        onChange={e => setEditData({...editData, caption: e.target.value})} 
                        placeholder="Keterangan opsional..."
                        className="bg-muted/30 border-border/80 rounded-xl text-xs min-h-[70px]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-border/60 text-xs">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground">Format</p>
                      <p className="font-bold text-foreground">{previewMedia?.mimeType.split('/')[1].toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground">Ukuran</p>
                      <p className="font-bold text-foreground">{previewMedia && formatFileSize(previewMedia.size)}</p>
                    </div>
                    {previewMedia?.width && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground">Dimensi</p>
                        <p className="font-bold text-foreground">{previewMedia.width} × {previewMedia.height}px</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground">Dibuat</p>
                      <p className="font-bold text-foreground">{previewMedia && new Date(previewMedia.createdAt).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 space-y-2">
                  <Button className="w-full h-8 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer" onClick={handleSaveMetadata} disabled={savingMetadata}>
                    {savingMetadata ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Simpan Perubahan
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-8 text-xs font-bold rounded-xl cursor-pointer" asChild>
                      <a href={previewMedia?.url} download target="_blank" rel="noreferrer">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> Unduh
                      </a>
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer" onClick={() => previewMedia && handleDelete(previewMedia.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  </div>
)
}
