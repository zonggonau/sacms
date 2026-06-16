import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Database, FileText, ImageIcon, PenTool, 
  Clock, ArrowRight, Sparkles, Zap
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default async function CMSDashboardPage({ 
  params 
}: { 
  params: Promise<{ tenant: string }> 
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params

  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenantId = access.tenantId
  const tenantDb = await getTenantDb(tenantSlug)

  const [
    tenantData,
    contentTypeCount,
    entriesByStatus,
    mediaCount,
    recentEntries,
    superAdmins,
  ] = await Promise.all([
    tenantDb.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true }
    }),
    tenantDb.tenantContentTypeAssignment.count({ where: { tenantId } }),
    tenantDb.contentEntry.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { _all: true },
    }),
    tenantDb.media.count({ where: { tenantId } }).catch(() => 0), // Fallback if schema differs
    tenantDb.contentEntry.findMany({
      where: { tenantId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: true,
        contentType: { select: { name: true, slug: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    db.user.findMany({ where: { role: "super_admin" }, select: { id: true } })
  ])

  const superAdminIds = new Set(superAdmins.map(u => u.id))
  const filteredRecentEntries = recentEntries
    .filter(e => !e.updatedBy || !superAdminIds.has(e.updatedBy))
    .slice(0, 8)

  const statusMap = Object.fromEntries(
    (entriesByStatus || []).map((g) => [g.status.toLowerCase(), g._count._all])
  )

  const totalEntries = entriesByStatus ? Object.values(statusMap).reduce((a, b) => (a as number) + (b as number), 0) : 0

  const stats = {
    contentTypeCount,
    totalEntries,
    mediaCount,
    entries: {
      draft: statusMap["draft"] || 0,
      in_review: statusMap["in_review"] || 0,
      published: statusMap["published"] || 0,
    },
    recentEntries: filteredRecentEntries.map((e) => ({
      id: e.id,
      status: e.status,
      contentType: e.contentType.name,
      contentTypeSlug: e.contentType.slug,
      updatedAt: e.updatedAt.toISOString(),
    })),
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Hi, {session.user.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm">Ready to craft some amazing content today?</p>
        </div>
        <div className="border border-border bg-card p-4 px-6 flex items-center gap-4 rounded-none shadow-none">
          <div className="w-10 h-10 bg-orange-500 flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>
            <p className="font-bold text-sm text-foreground">
              {tenantData?.name || tenantSlug}
            </p>
          </div>
        </div>
      </div>

      {/* Mini Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[
          { label: "Active Collections", value: stats.contentTypeCount, icon: Database },
          { label: "Total Entries", value: stats.totalEntries, icon: FileText },
          { label: "Media Assets", value: stats.mediaCount, icon: ImageIcon },
        ].map((s) => (
          <Card key={s.label} className="border border-border shadow-none bg-card rounded-none">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted flex items-center justify-center shrink-0 border border-border">
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{s.label}</p>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Work */}
        <Card className="lg:col-span-2 border border-border shadow-none bg-card rounded-none overflow-hidden">
          <CardHeader className="bg-muted/50 border-b border-border p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-orange-500" /> Recent Content Edits
              </CardTitle>
              <Badge variant="outline" className="font-bold text-[9px] rounded-none px-2 py-0.5">LATEST</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentEntries.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <PenTool className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm">No content has been created yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {stats.recentEntries.map((entry) => (
                  <div key={entry.id} className="p-4 px-6 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 border border-border bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-orange-500 group-hover:text-white transition-colors">
                        <FileText className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{entry.contentType}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Last edited {new Date(entry.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className={cn(
                        "text-[9px] font-bold uppercase px-2 py-0.5 rounded-none border",
                        entry.status === 'PUBLISHED' 
                          ? 'border-orange-500 text-orange-500 bg-orange-500/5 dark:bg-orange-950/10' 
                          : 'border-amber-500 text-amber-600 bg-amber-50/50 dark:bg-amber-950/20'
                      )}>
                        {entry.status}
                      </Badge>
                      <Link href={`/cms/${tenantSlug}/content/${entry.contentTypeSlug}`}>
                        <Button variant="outline" size="icon" className="rounded-none h-8 w-8 hover:bg-muted">
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
          <Card className="border border-border bg-card shadow-none rounded-none overflow-hidden relative">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Zap className="h-4 w-4 text-orange-500 fill-current" /> Pro Tip
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                You can use the **AI Content Assistant** inside any text field to help you generate headlines, translate copy, or summarize long articles in seconds.
              </p>
              <Button variant="outline" className="w-full font-bold rounded-none border border-border h-9 text-xs" asChild>
                <Link href={`/cms/${tenantSlug}/media`}>Explore Media</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-none bg-card rounded-none overflow-hidden">
            <CardHeader className="pb-2 p-6 border-b border-border bg-muted/50">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Workflow Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-6">
              {[
                { label: "Drafts", count: stats.entries.draft, color: "bg-zinc-400" },
                { label: "In Review", count: stats.entries.in_review, color: "bg-amber-500" },
                { label: "Published", count: stats.entries.published, color: "bg-orange-500" },
              ].map((w) => (
                <div key={w.label} className="flex items-center justify-between p-3 rounded-none bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-none", w.color)} />
                    <span className="text-xs font-semibold text-muted-foreground">{w.label}</span>
                  </div>
                  <span className="text-sm font-bold">{w.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
