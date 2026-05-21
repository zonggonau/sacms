"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Loader2, Image as ImageIcon, Folder, Upload, Search, Plus, 
  Building2, HardDrive, File, LayoutGrid, List, ExternalLink,
  Filter, ArrowRight
} from "lucide-react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TenantStat {
  tenant: { id: string; name: string; slug: string }
  fileCount: number
  totalSize: number
}

interface MediaFile {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  url: string
  thumbnailUrl: string | null
  createdAt: string
  tenant: { id: string; name: string; slug: string }
}

export default function AdminMediaPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0, totalFolders: 0 })
  const [tenantStats, setTenantStats] = useState<TenantStat[]>([])
  const [recentMedia, setRecentMedia] = useState<MediaFile[]>([])
  
  // View & Filter States
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/media")
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats || { totalFiles: 0, totalSize: 0, totalFolders: 0 })
        setTenantStats(data.tenantStats || [])
        setRecentMedia(data.recentMedia || [])
      }
    } catch (error) {
      console.error("Failed to fetch media:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchData()
  }, [session])

  const filteredMedia = useMemo(() => {
    return recentMedia.filter(m => 
      m.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.tenant.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [recentMedia, searchQuery])

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex">
<div className="flex-1 min-h-screen flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  return (
    <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Global Media Library</h1>
              <p className="text-muted-foreground">Manage and audit assets across all tenant workspaces.</p>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Assets</p>
                  <p className="text-2xl font-black">{stats.totalFiles.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <HardDrive className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Storage Used</p>
                  <p className="text-2xl font-black">{formatSize(stats.totalSize)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-sm border-none">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <Folder className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Global Folders</p>
                  <p className="text-2xl font-black">{stats.totalFolders}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Left: Tenant Usage */}
            <div className="lg:col-span-1 space-y-6">
              <Card className="shadow-sm border-none bg-card">
                <CardHeader>
                  <CardTitle className="text-base font-bold">Storage by Workspace</CardTitle>
                  <CardDescription className="text-xs">Top 10 consumers of object storage</CardDescription>
                </CardHeader>
                <CardContent className="p-0 border-t">
                  <div className="divide-y">
                    {tenantStats.map((ts) => (
                      <div key={ts.tenant.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate leading-none">{ts.tenant.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 font-mono">/{ts.tenant.slug}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold">{ts.fileCount} files</p>
                          <p className="text-[10px] text-muted-foreground">{formatSize(ts.totalSize)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Recent Files explorer */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-sm border-none overflow-hidden bg-card">
                <CardHeader className="bg-card border-b">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-base font-bold">Recent Platform Assets</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input 
                          placeholder="Search filename..." 
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="pl-8 h-8 text-xs bg-muted/50 border-none w-[180px]"
                        />
                      </div>
                      <div className="flex bg-muted p-1 rounded-lg">
                        <Button 
                          variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => setViewMode('grid')}
                        >
                          <LayoutGrid className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                          size="icon" 
                          className="h-6 w-6" 
                          onClick={() => setViewMode('list')}
                        >
                          <List className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  {filteredMedia.length === 0 ? (
                    <div className="text-center py-20">
                      <File className="h-12 w-12 mx-auto mb-4 opacity-10" />
                      <p className="text-sm text-muted-foreground">No media files match your query.</p>
                      <Link href="/admin/tenants">
                        <Button variant="link" className="mt-2 text-primary">Manage Workspaces <ArrowRight className="ml-1 h-3 w-3" /></Button>
                      </Link>
                    </div>
                  ) : viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {filteredMedia.map((file) => (
                        <div key={file.id} className="group relative border rounded-xl overflow-hidden bg-muted/20 hover:border-primary/50 transition-all shadow-sm">
                          <div className="aspect-square flex items-center justify-center bg-muted/50 overflow-hidden">
                            {file.mimeType.startsWith("image/") ? (
                              <img 
                                src={file.thumbnailUrl || file.url} 
                                alt={file.name}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                            ) : (
                              <File className="h-10 w-10 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="p-2 bg-card">
                            <p className="text-[10px] font-bold truncate leading-tight">{file.originalName}</p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-muted-foreground">{formatSize(file.size)}</span>
                              <Badge variant="outline" className="text-[8px] py-0 px-1 border-primary/20 text-primary">{file.tenant.name.split(' ')[0]}</Badge>
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full" asChild>
                              <a href={file.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                            </Button>
                            <Link href={`/dashboard/${file.tenant.slug}/media`}>
                              <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full"><Folder className="h-4 w-4" /></Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredMedia.map((file) => (
                        <div key={file.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 border overflow-hidden">
                              {file.mimeType.startsWith("image/") ? (
                                <img src={file.thumbnailUrl || file.url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <File className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{file.originalName}</p>
                              <p className="text-[10px] text-muted-foreground">{file.mimeType} &middot; {formatSize(file.size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] font-bold text-primary uppercase leading-none">{file.tenant.name}</p>
                              <p className="text-[9px] text-muted-foreground mt-1">{new Date(file.createdAt).toLocaleDateString()}</p>
                            </div>
                            <Link href={`/dashboard/${file.tenant.slug}/media`}>
                              <Button variant="outline" size="sm" className="h-8">Open Library</Button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
