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
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
              CMS Content Studio
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              {tenantData?.name || tenantSlug}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Halo {session.user.name?.split(' ')[0]} 👋 Siap untuk mengelola dan mempublikasikan konten hari ini?
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button asChild variant="outline" className="h-9 px-3 text-xs font-semibold rounded-xl border-border/80 bg-card hover:bg-muted/50">
            <Link href={`/dashboard/${tenantSlug}/cms/media`}>
              <ImageIcon className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              Media Library
            </Link>
          </Button>

          <Button asChild className="h-9 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all">
            <Link href={`/dashboard/${tenantSlug}/content-type-builder/content-types`}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Kelola Skema
            </Link>
          </Button>
        </div>
      </div>

      {/* Mini Metric Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Koleksi Tipe Konten", value: stats.contentTypeCount, icon: Database, color: "text-primary", bg: "bg-primary/10" },
          { label: "Total Entri Konten", value: stats.totalEntries, icon: FileText, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: "Aset Media Tersimpan", value: stats.mediaCount, icon: ImageIcon, color: "text-blue-500", bg: "bg-blue-500/10" },
        ].map((s) => (
          <Card key={s.label} className="border border-border/80 bg-card rounded-2xl shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-black text-foreground">{s.value}</p>
              </div>
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-5 w-5", s.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Content Edits */}
        <Card className="lg:col-span-2 border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
          <CardHeader className="p-5 pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                <Clock className="h-4 w-4 text-primary" /> Pembaruan Konten Terakhir
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-bold rounded-full px-2 py-0.5 border-border">
                Aktivitas Terbaru
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats.recentEntries.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground space-y-2">
                <PenTool className="h-8 w-8 mx-auto opacity-30" />
                <p className="text-xs font-semibold text-foreground">Belum ada konten yang dibuat</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">Pilih koleksi konten di menu samping untuk membuat entri pertama Anda.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {stats.recentEntries.map((entry) => (
                  <div key={entry.id} className="p-3.5 px-5 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{entry.contentType}</p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          Diperbarui {new Date(entry.updatedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border-0",
                        entry.status === 'PUBLISHED' 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      )}>
                        {entry.status}
                      </Badge>
                      <Link href={`/dashboard/${tenantSlug}/cms/content/${entry.contentTypeSlug}`}>
                        <Button variant="ghost" size="icon" className="rounded-lg h-7 w-7 text-muted-foreground hover:text-foreground">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workflow Overview & Pro Tips */}
        <div className="space-y-6">
          <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2 border-b border-border/60">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status Alur Kerja</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-3">
              {[
                { label: "Draft", count: stats.entries.draft, dot: "bg-slate-400" },
                { label: "In Review", count: stats.entries.in_review, dot: "bg-amber-500" },
                { label: "Published", count: stats.entries.published, dot: "bg-emerald-500" },
              ].map((w) => (
                <div key={w.label} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border/60">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", w.dot)} />
                    <span className="text-xs font-semibold text-muted-foreground">{w.label}</span>
                  </div>
                  <span className="text-xs font-black text-foreground">{w.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border border-border/80 bg-card rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Tips AI Studio
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Manfaatkan <strong>AI Content Assistant</strong> di setiap editor konten untuk membuat artikel, menerjemahkan bahasa, atau meringkas teks secara instan.
              </p>
              <Button variant="outline" className="w-full font-bold rounded-xl border-border/80 h-8 text-xs bg-muted/30 hover:bg-muted/60" asChild>
                <Link href={`/dashboard/${tenantSlug}/cms/media`}>Buka Media Library</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
