import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import Link from "next/link"
import {
  Globe,
  Plus,
  ArrowRight,
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Server,
  FolderTree,
  Database,
  Users,
  CreditCard,
  Settings,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getUserPlanConfig } from "@/lib/tenant-plan"

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "sacms.cloud"

export default async function OwnerDashboardPage({
  params,
}: {
  params: Promise<{ ownerId: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { ownerId } = await params

  const ownerUser = await db.user.findFirst({
    where: {
      OR: [
        { ownerSlug: ownerId },
        { id: ownerId },
        { email: ownerId },
      ],
    },
    include: {
      ownedTenants: {
        include: {
          customDomains: true,
          _count: {
            select: {
              contentEntries: true,
              contentTypes: true,
              members: true,
              apiKeys: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!ownerUser) {
    redirect("/dashboard")
  }

  // Also include workspaces where the user is a member with owner/admin role
  const memberWorkspaces = await db.tenant.findMany({
    where: {
      members: {
        some: {
          userId: ownerUser.id,
          role: { in: ["owner", "admin"] },
        },
      },
      id: { notIn: ownerUser.ownedTenants.map((t) => t.id) },
    },
    include: {
      customDomains: true,
      _count: {
        select: {
          contentEntries: true,
          contentTypes: true,
          members: true,
          apiKeys: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const allWorkspaces = [...ownerUser.ownedTenants, ...memberWorkspaces]
  const planConfig = await getUserPlanConfig(ownerUser.id)
  const ownerSubdomain = `${ownerUser.ownerSlug || ownerUser.id}.${ROOT_DOMAIN}`

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-base">
                <Layers className="h-5 w-5" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                Owner Portal Hub
              </h1>
              <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-xs font-mono font-bold">
                {ownerSubdomain}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Portal manajemen terpusat untuk akun Owner <strong>{ownerUser.name || ownerUser.email}</strong>. Seluruh workspace, subdomain, dan pengaturan kustom Anda terkelola secara otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/dashboard">
              <Button className="rounded-xl h-10 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-sm flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Buat Workspace Baru
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/60">
          <div className="p-3.5 rounded-2xl bg-background/80 border border-border/70 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-primary" /> Total Workspace
            </span>
            <div className="text-xl font-black text-foreground">{allWorkspaces.length} <span className="text-xs text-muted-foreground font-normal">/ {planConfig.max_workspaces}</span></div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-border/70 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-blue-500" /> Domain Kustom
            </span>
            <div className="text-xl font-black text-foreground">
              {allWorkspaces.reduce((acc, w) => acc + w.customDomains.length, 0)}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-border/70 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-emerald-500" /> Paket Akun
            </span>
            <div className="text-xl font-black text-foreground capitalize">{ownerUser.plan}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-border/70 space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" /> AI Credits
            </span>
            <div className="text-xl font-black text-foreground">{planConfig.max_ai_credits || 0}</div>
          </div>
        </div>
      </div>

      {/* Workspace List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              Daftar Workspace ({allWorkspaces.length})
            </h2>
            <p className="text-xs text-muted-foreground">Setiap workspace memiliki dedicated subdomain dan CMS tersendiri.</p>
          </div>
        </div>

        {allWorkspaces.length === 0 ? (
          <Card className="rounded-2xl border border-dashed border-border/80 p-8 text-center bg-card">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto text-muted-foreground">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-sm text-foreground">Belum Ada Workspace</h3>
              <p className="text-xs text-muted-foreground">
                Mulai buat workspace pertama Anda untuk mulai mengelola konten, API, dan skema data.
              </p>
              <Link href="/dashboard">
                <Button size="sm" className="rounded-xl mt-2 font-bold text-xs bg-primary text-primary-foreground">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Buat Workspace
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allWorkspaces.map((ws) => {
              const directSubdomain = `${ws.slug}.${ROOT_DOMAIN}`
              const primaryDomain = ws.customDomains.find((d) => d.isPrimary)?.domain || directSubdomain

              return (
                <Card key={ws.id} className="rounded-2xl border border-border/80 shadow-xs hover:border-primary/40 transition-all bg-card overflow-hidden flex flex-col justify-between">
                  <div>
                    {/* Card Header */}
                    <CardHeader className="p-5 pb-3 border-b border-border/50 bg-muted/10">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-bold text-foreground line-clamp-1">{ws.name}</CardTitle>
                          <code className="text-xs font-mono font-bold text-primary flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {directSubdomain}
                          </code>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize font-bold border-border/80 shrink-0">
                          {ws.plan}
                        </Badge>
                      </div>
                    </CardHeader>

                    {/* Card Body Metrics */}
                    <CardContent className="p-5 space-y-4 text-xs">
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[10px] block">Konten & Entri</span>
                          <span className="font-bold text-foreground text-sm">{ws._count.contentEntries} entri</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40">
                          <span className="text-[10px] block">Model Konten</span>
                          <span className="font-bold text-foreground text-sm">{ws._count.contentTypes} skema</span>
                        </div>
                      </div>

                      {/* Custom Domain Tags */}
                      {ws.customDomains.length > 0 && (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Custom Domains:</span>
                          <div className="flex flex-wrap gap-1">
                            {ws.customDomains.map((cd) => (
                              <Badge key={cd.id} variant="secondary" className="text-[10px] font-mono py-0 h-5">
                                {cd.domain}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-border/40 mt-2">
                    <Link
                      href={`/dashboard/${ws.slug}`}
                      className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-muted"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Pengaturan
                    </Link>

                    <Link
                      href={`/dashboard/${ws.slug}/cms`}
                      className="text-xs font-bold text-primary hover:text-primary/90 flex items-center gap-1 py-1.5 px-3 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      Buka CMS Studio
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
