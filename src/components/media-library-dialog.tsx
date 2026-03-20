"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Link, Image as ImageIcon, FileText, Loader2, Search, Info } from "lucide-react"

interface MediaItem {
  id: string
  name: string
  url: string
  type: "image" | "file"
  mimeType?: string
  createdAt: string
}

interface MediaLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (media: { url: string; name: string; type: "image" | "file" }) => void
  mediaType?: "image" | "file" | "both"
  tenantSlug?: string // Added tenantSlug prop
}

export function MediaLibraryDialog({
  open,
  onOpenChange,
  onSelect,
  mediaType = "both",
  tenantSlug,
}: MediaLibraryDialogProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload" | "url">("library")
  const [libraryItems, setLibraryItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  // Fetch library items
  useEffect(() => {
    if (open && activeTab === "library") {
      fetchLibraryItems()
    }
  }, [open, activeTab])

  const fetchLibraryItems = async () => {
    setLoading(true)
    try {
      // Use tenant API if slug is provided, otherwise global admin API
      const endpoint = tenantSlug 
        ? `/api/tenant/${tenantSlug}/media` 
        : `/api/admin/media?type=${mediaType}`
        
      const response = await fetch(endpoint)
      if (!response.ok) {
        let errorMessage = "Failed to fetch media"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      
      // Normalize data from different endpoints
      const rawMedia = data.media || []
      const normalizedMedia: MediaItem[] = rawMedia.map((m: any) => ({
        id: m.id,
        name: m.originalName || m.name,
        url: m.url,
        type: m.mimeType?.startsWith("image/") ? "image" : "file",
        mimeType: m.mimeType,
        createdAt: m.createdAt,
      }))
      
      setLibraryItems(normalizedMedia)
    } catch (error) {
      console.error("Error fetching media:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("files", uploadFile) // Use "files" key to match tenant API

      // Use tenant upload API if slug is provided
      const endpoint = tenantSlug 
        ? `/api/tenant/${tenantSlug}/media` 
        : "/api/admin/media/upload"

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const data = await response.json()
      // Tenant API returns { media: Media[] }
      const uploadedFile = tenantSlug ? data.media[0] : data

      onSelect({
        url: uploadedFile.url,
        name: uploadedFile.originalName || uploadedFile.name,
        type: uploadFile.type.startsWith("image/") ? "image" : "file",
      })
      
      setUploadFile(null)
      onOpenChange(false)
    } catch (error: any) {
      console.error("Error uploading:", error)
      alert(error.message || "Failed to upload file")
    } finally {
      setUploading(false)
    }
  }

  const handleUrlSubmit = () => {
    if (!imageUrl.trim()) return
    onSelect({
      url: imageUrl,
      name: imageUrl.split("/").pop() || "External URL",
      type: "image",
    })
    setImageUrl("")
    onOpenChange(false)
  }

  const filteredItems = libraryItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const isUploadedImage = uploadFile?.type.startsWith("image/")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
        <DialogHeader className="p-6 bg-muted/20 border-b">
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Media Library {tenantSlug && <span className="text-muted-foreground font-medium lowercase">({tenantSlug})</span>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4 border-b bg-card">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="library" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ImageIcon className="h-4 w-4 mr-2" />
                Library
              </TabsTrigger>
              <TabsTrigger value="upload" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Upload className="h-4 w-4 mr-2" />
                Upload New
              </TabsTrigger>
              <TabsTrigger value="url" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Link className="h-4 w-4 mr-2" />
                From URL
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Library Tab */}
            <TabsContent value="library" className="mt-0 outline-none h-full">
              <div className="space-y-4 h-full flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assets by filename..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10 bg-muted/30 border-none rounded-xl"
                  />
                </div>

                {loading ? (
                  <div className="flex-1 flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-xs font-bold uppercase tracking-widest">Indexing assets...</p>
                    </div>
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-20">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="h-8 w-8 text-muted-foreground opacity-20" />
                      </div>
                      <p className="font-bold text-muted-foreground">No assets found</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Try a different keyword or upload new file</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="group relative aspect-square rounded-xl border overflow-hidden cursor-pointer hover:border-primary/50 transition-all bg-muted/20"
                        onClick={() => onSelect(item)}
                      >
                        {item.type === "image" ? (
                          <img
                            src={item.url}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <FileText className="h-10 w-10 text-muted-foreground/40" />
                            <span className="text-[10px] font-bold uppercase mt-2 text-muted-foreground/60">{item.mimeType?.split('/')[1]}</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <p className="text-[9px] font-bold text-white bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm truncate w-full">
                            {item.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Upload Tab */}
            <TabsContent value="upload" className="mt-0 outline-none">
              <div className="space-y-6">
                <div
                  className="border-2 border-dashed rounded-2xl p-12 text-center hover:bg-muted/30 transition-all cursor-pointer border-muted-foreground/20 group"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <input
                    id="file-upload"
                    type="file"
                    className="hidden"
                    accept={mediaType === "image" ? "image/*" : undefined}
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                  {uploadFile ? (
                    <div className="space-y-4">
                      {isUploadedImage ? (
                        <div className="relative w-48 h-48 mx-auto rounded-xl overflow-hidden shadow-lg">
                          <img
                            src={URL.createObjectURL(uploadFile)}
                            alt={uploadFile.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-20 h-20 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto">
                          <FileText className="h-10 w-10 text-primary" />
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-sm truncate max-w-[300px] mx-auto">{uploadFile.name}</p>
                        <p className="text-[10px] font-black uppercase text-muted-foreground mt-1">
                          {(uploadFile.size / 1024).toFixed(1)} KB &middot; {uploadFile.type}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setUploadFile(null) }} className="text-xs text-destructive">
                        Remove and choose another
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                        <Upload className="h-8 w-8 text-primary" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-bold">Select files from your device</p>
                        <p className="text-xs text-muted-foreground">
                          {mediaType === "image"
                            ? "PNG, JPG, WEBP or GIF (Max 10MB)"
                            : "Images or documents (Max 10MB)"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20 rounded-xl"
                >
                  {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Start Upload"}
                </Button>
              </div>
            </TabsContent>

            {/* URL Tab */}
            <TabsContent value="url" className="mt-0 outline-none">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Remote Image URL</Label>
                  <Input
                    placeholder="https://images.unsplash.com/photo-..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-11 bg-muted/30 border-none rounded-xl"
                  />
                </div>

                <Button
                  onClick={handleUrlSubmit}
                  disabled={!imageUrl.trim()}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
                >
                  Import from URL
                </Button>

                <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex gap-3 text-primary shadow-sm">
                  <Info className="h-5 w-5 shrink-0" />
                  <p className="text-[11px] leading-relaxed">
                    Importing from a URL will link the asset directly from its source. Ensure you have the appropriate permissions to use external media.
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
        
        <div className="p-4 bg-muted/30 border-t flex justify-end gap-2">
          <Button variant="ghost" className="rounded-xl font-bold text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
