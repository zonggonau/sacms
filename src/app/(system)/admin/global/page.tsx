"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import {
  Loader2, Globe, RefreshCw, CheckCircle2,
  Database, Zap, FileText, ExternalLink, LayoutDashboard, Edit,
} from "lucide-react"

interface ContentTypeSummary {
  slug: string
  name: string
  publishedEntries: number
}

interface GlobalStatus {
  exists: boolean
  tenantId?: string
  tenantSlug?: string
  contentTypes?: ContentTypeSummary[]
}

interface SeedResult {
  success: boolean
  tenantId: string
  tenantSlug: string
  results: Record<string, { created: number; skipped: number }>
}

const SECTION_LABELS: Record<string, string> = {
  "sacms-hero":              "Hero Section",
  "sacms-features":          "Features",
  "sacms-account-pricing":   "Account Plans",
  "sacms-workspace-pricing": "Workspace Plans",
  "sacms-addons":            "Add-ons",
  "sacms-workflow":          "Workflow Steps",
  "sacms-faq":               "FAQ",
  "sacms-testimonials":      "Testimonials",
  "sacms-owners":            "Team / Owners",
  "sacms-about":             "About Section",
  "sacms-whatsapp":          "WhatsApp Config",
}

export default function GlobalContentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [globalStatus, setGlobalStatus] = useState<GlobalStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [lastResult, setLastResult] = useState<SeedResult | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/global/seed")
      if (res.ok) setGlobalStatus(await res.json())
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load status." })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user?.role === "super_admin") fetchStatus()
  }, [session])

  const handleSetup = async () => {
    setSeeding(true)
    try {
      const res = await fetch("/api/admin/global/seed", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        setLastResult(data)
        await fetchStatus()
        const totalCreated = Object.values(data.results as Record<string, { created: number }>)
          .reduce((s, r) => s + r.created, 0)
        toast({
          title: "Setup Complete!",
          description: totalCreated > 0
            ? `${totalCreated} entries seeded into sacms-global.`
            : "Global tenant already set up — nothing duplicated.",
        })
      } else {
        toast({ variant: "destructive", title: "Setup Failed", description: data.error || "Unknown error" })
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Request failed." })
    } finally {
      setSeeding(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-1 flex-col w-full">
<div className="flex-1 flex items-center justify-center flex-col w-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (session?.user?.role !== "super_admin") {
    router.push("/dashboard")
    return null
  }

  const totalEntries = globalStatus?.contentTypes?.reduce((s, c) => s + c.publishedEntries, 0) ?? 0
  const totalTypes = globalStatus?.contentTypes?.length ?? 0
  const hasData = (globalStatus?.contentTypes?.filter(c => c.publishedEntries > 0).length ?? 0) > 0

  return (
    <div className="flex text-foreground flex-1 flex-col w-full">
<div className="flex-1 flex-col w-full">
        <div className="p-6 md:p-10 space-y-8 w-full">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div className="flex items-center gap-3">
              <Globe className="h-6 w-6 text-orange-500" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Global Content Setup</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Inisialisasi konten platform (Truly Global) untuk landing page dan blueprint sistem.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-none border-border shrink-0"
              onClick={fetchStatus}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Main Setup Card */}
          <Card className="rounded-none border border-border shadow-none">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-5">
                  <div className={`w-14 h-14 shrink-0 flex items-center justify-center border ${hasData ? "bg-blue-500 border-blue-500" : "bg-orange-500 border-orange-500"}`}>
                    {hasData
                      ? <CheckCircle2 className="h-7 w-7 text-white" />
                      : <Database className="h-7 w-7 text-white" />
                    }
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-bold text-lg text-foreground">
                      {hasData
                        ? "Konten Platform Aktif"
                        : "Konten belum di-seed"
                      }
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {hasData
                        ? `${totalEntries} entries di ${totalTypes} content types. Landing page sudah mengambil data Truly Global tanpa owner tenant.`
                        : "Klik Setup untuk menginisialisasi skema platform (Pricing, Hero, Features) secara Truly Global."
                      }
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0 w-full md:w-auto">
                  <Button
                    className="rounded-none bg-orange-500 hover:bg-orange-600 text-white font-semibold h-11 px-6"
                    onClick={handleSetup}
                    disabled={seeding}
                  >
                    {seeding
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up...</>
                      : hasData
                        ? <><Zap className="mr-2 h-4 w-4" /> Re-Seed Global Data</>
                        : <><Database className="mr-2 h-4 w-4" /> Setup Global Content</>
                    }
                  </Button>

                  <a href="/" target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="rounded-none border-border h-11 px-5 w-full sm:w-auto">
                      <ExternalLink className="mr-2 h-4 w-4" /> Preview Site
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Seed Result */}
          {lastResult && (
            <Card className="rounded-none border border-border shadow-none">
              <CardHeader className="border-b border-border px-6 py-4">
                <CardTitle className="text-sm font-bold">Hasil Setup</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {Object.entries(lastResult.results).map(([slug, result]) => (
                    <div key={slug} className="flex items-center justify-between px-6 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-semibold">{SECTION_LABELS[slug] || slug}</p>
                          <code className="text-xs text-muted-foreground font-mono">{slug}</code>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {result.created > 0 && (
                          <Badge className="rounded-none bg-green-500 text-white text-xs">+{result.created}</Badge>
                        )}
                        {result.skipped > 0 && (
                          <Badge variant="outline" className="rounded-none text-xs">{result.skipped} skipped</Badge>
                        )}
                        {result.created === 0 && result.skipped === 0 && (
                          <Badge variant="outline" className="rounded-none text-xs">—</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Content Status */}
          {globalStatus?.exists && globalStatus.contentTypes && globalStatus.contentTypes.length > 0 && (
            <Card className="rounded-none border border-border shadow-none">
              <CardHeader className="border-b border-border px-6 py-4 bg-card">
                <CardTitle className="text-base font-bold">Status Konten Platform</CardTitle>
              </CardHeader>
              <CardContent className="p-0 bg-card">
                <div className="divide-y divide-border">
                  {globalStatus.contentTypes.map((ct) => (
                    <div key={ct.slug} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 pl-2">
                        <div className={`w-2.5 h-2.5 shrink-0 rounded-full ${ct.publishedEntries > 0 ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-muted-foreground/30"}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate text-foreground">{SECTION_LABELS[ct.slug] || ct.name}</p>
                          <code className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5">{ct.slug}</code>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 pr-2">
                        <Badge
                          className={`rounded-none text-[10px] font-black uppercase shrink-0 ${ct.publishedEntries > 0 ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground"}`}
                        >
                          {ct.publishedEntries > 0 ? `${ct.publishedEntries} Entries` : "Empty"}
                        </Badge>

                        <Link href={`/admin/content-types/${ct.slug}`}>
                          <Button variant="ghost" size="sm" className="h-8 rounded-none border border-border bg-background hover:bg-muted font-bold text-[10px] uppercase gap-1.5 px-3">
                            <Edit className="h-3 w-3" /> Manage
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}
