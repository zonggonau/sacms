"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, Database, FileText, ImageIcon, 
  PenTool, Clock, CheckCircle2, Eye, ArrowRight,
  TrendingUp, Sparkles, MessageSquare, Zap
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface CMSStats {
  contentTypeCount: number
  totalEntries: number
  mediaCount: number
  entries: {
    draft: number
    in_review: number
    published: number
  }
  recentEntries: Array<{
    id: string
    status: string
    contentType: string
    contentTypeSlug: string
    updatedAt: string
  }>
}

export default function CMSDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantId = params?.tenant as string

  const [stats, setStats] = useState<CMSStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      if (!tenantId) return
      try {
        const res = await fetch(`/api/tenant/${tenantId}/stats`)
        if (res.ok) {
          setStats(await res.json())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [tenantId])

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Hi, {session?.user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground text-lg">Ready to craft some amazing content today?</p>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-4 px-6 text-white shadow-lg shadow-emerald-200 dark:shadow-none flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Workspace</p>
            <p className="font-bold">{tenantId}</p>
          </div>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: "Active Collections", value: stats?.contentTypeCount ?? 0, icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Entries", value: stats?.totalEntries ?? 0, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Media Assets", value: stats?.mediaCount ?? 0, icon: ImageIcon, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((s) => (
          <Card key={s.label} className="border-none shadow-sm bg-card">
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-6 w-6 ${s.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{s.label}</p>
                <p className="text-2xl font-black">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Work */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-emerald-600" /> Recent Content Edits
              </CardTitle>
              <Badge variant="outline" className="font-black text-[10px]">LATEST</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!stats?.recentEntries || stats.recentEntries.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <PenTool className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p>No content has been created yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {stats.recentEntries.map((entry) => (
                  <div key={entry.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-emerald-500 group-hover:text-white transition-all">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{entry.contentType}</p>
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">
                          Last edited {new Date(entry.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={cn(
                        "text-[9px] font-black uppercase px-2 py-0.5",
                        entry.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {entry.status}
                      </Badge>
                      <Link href={`/cms/${tenantId}/content/${entry.contentTypeSlug}`}>
                        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Tips & Status */}
        <div className="space-y-6">
          <Card className="bg-emerald-600 text-white border-none shadow-xl rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl" />
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 fill-current" /> Pro Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <p className="text-sm font-medium leading-relaxed opacity-90">
                You can use the **AI Content Assistant** inside any text field to help you generate headlines, translate copy, or summarize long articles in seconds.
              </p>
              <Button variant="secondary" className="w-full font-bold text-emerald-700 rounded-xl h-10 shadow-lg" asChild>
                <Link href={`/cms/${tenantId}/media`}>Explore Media</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Workflow Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-4 pt-2">
              {[
                { label: "Drafts", count: stats?.entries.draft ?? 0, color: "bg-slate-400" },
                { label: "In Review", count: stats?.entries.in_review ?? 0, color: "bg-amber-500" },
                { label: "Published", count: stats?.entries.published ?? 0, color: "bg-emerald-500" },
              ].map((w) => (
                <div key={w.label} className="flex items-center justify-between p-3 rounded-2xl bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", w.color)} />
                    <span className="text-xs font-bold text-muted-foreground">{w.label}</span>
                  </div>
                  <span className="text-sm font-black">{w.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
