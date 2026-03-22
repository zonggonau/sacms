"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { 
  Loader2, ArrowLeft, Globe, Eye, 
  Clock, Share2, ShieldCheck, AlertCircle,
  Calendar, User
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface ContentEntry {
  id: string
  data: any
  status: string
  updatedAt: string
}

interface ContentType {
  id: string
  name: string
  fields: any[]
}

export default function PreviewPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  
  const tenantSlug = params?.tenant as string
  const contentTypeSlug = params?.slug as string
  const entryId = params?.id as string

  const [entry, setEntry] = useState<ContentEntry | null>(null)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPreview() {
      if (!tenantSlug || !contentTypeSlug || !entryId) return
      
      try {
        const [ctRes, entRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}`),
          fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}`)
        ])

        if (!ctRes.ok || !entRes.ok) {
          throw new Error("Failed to load preview data. Access denied or not found.")
        }

        const ctData = await ctRes.json()
        const entData = await entRes.json()
        
        setContentType(ctData)
        
        let parsedData = entData.entry.data
        if (typeof entData.entry.data === 'string') {
          try { parsedData = JSON.parse(entData.entry.data) } catch { parsedData = {} }
        }
        
        setEntry({ ...entData.entry, data: parsedData })
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchPreview()
    } else if (status === "unauthenticated") {
      setError("Unauthorized. Please log in to view previews.")
      setLoading(false)
    }
  }, [tenantSlug, contentTypeSlug, entryId, status])

  if (loading) {
    return (
      <div className="min-h-screen bg-card p-10 flex flex-col items-center justify-center gap-6">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-500" />
        <p className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">Initializing Preview Mode...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-card p-10 flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500">
          <AlertCircle className="h-8 w-8" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-tight text-foreground">Access Denied</h2>
          <p className="text-muted-foreground font-medium max-w-md">{error}</p>
        </div>
        <Button onClick={() => window.close()} variant="outline" className="rounded-xl font-bold">Close Preview</Button>
      </div>
    )
  }

  const data = entry?.data || {}
  const title = data.judul_berita || data.judul || data.title || "Untitled Preview"
  const content = data.konten || data.content || data.body || ""
  const cover = data.gambar_utama || data.cover || data.image || data.thumbnail
  const date = entry?.updatedAt ? new Date(entry.updatedAt).toLocaleDateString("en-US", { 
    day: 'numeric', month: 'long', year: 'numeric' 
  }) : "-"

  return (
    <div className="min-h-screen bg-card">
      {/* Admin Preview Header */}
      <div className="sticky top-0 z-50 w-full bg-emerald-600/95 backdrop-blur-md text-white border-b border-emerald-500/30 px-6 h-14 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-4">
          <Badge className="bg-white/20 hover:bg-white/30 text-white border-none text-[10px] font-black uppercase tracking-widest px-3 py-1">
            <Eye className="h-3 w-3 mr-1.5" /> Preview Mode
          </Badge>
          <div className="h-4 w-[1px] bg-white/20" />
          <p className="text-xs font-bold text-emerald-50/80 truncate max-w-[300px]">
            {contentType?.name} &rsaquo; {title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100 hidden sm:block">Draft Version</span>
          <Button variant="ghost" size="sm" onClick={() => window.close()} className="text-white hover:bg-white/10 font-bold rounded-lg h-8 text-xs">
            Close
          </Button>
        </div>
      </div>

      {/* Actual Content Layout (Mimicking Frontend) */}
      <main className="max-w-4xl mx-auto px-6 pt-16 pb-32">
        <div className="space-y-12">
          {/* Article Header */}
          <div className="space-y-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <Badge variant="outline" className="text-emerald-600 border-emerald-100 bg-emerald-50/50 uppercase font-black tracking-widest text-[10px]">
                {contentType?.name}
              </Badge>
              <span className="text-muted-foreground text-xs font-medium">&bull;</span>
              <span className="text-muted-foreground text-xs font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {date}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
              {title}
            </h1>
            
            <div className="flex items-center justify-center gap-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                <User className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Editor Preview</p>
                <p className="text-xs font-bold text-foreground">Draft Content</p>
              </div>
            </div>
          </div>

          {/* Cover Image */}
          {cover && (
            <div className="relative aspect-[16/9] rounded-3xl overflow-hidden shadow-2xl border border-muted ring-8 ring-muted/30">
              <img src={cover} alt={title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Article Content */}
          <article className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-black prose-p:leading-relaxed prose-emerald prose-img:rounded-2xl">
            {content ? (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            ) : (
              <div className="py-20 text-center border-2 border-dashed border-muted rounded-3xl">
                <AlertCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-bold">No content body has been written yet.</p>
              </div>
            )}
          </article>
        </div>
      </main>

      {/* Floating Preview Info */}
      <div className="fixed bottom-8 right-8 bg-card border border-muted shadow-2xl rounded-2xl p-5 w-72 animate-in slide-in-from-bottom-10">
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-muted">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-foreground">Verified Access</p>
            <p className="text-[10px] font-bold text-emerald-600">You are in Preview Mode</p>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
          Changes made here are <strong className="text-foreground">NOT LIVE</strong>. This page is only visible to authenticated team members.
        </p>
      </div>
    </div>
  )
}
