"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Server, Rocket, Globe, Variable, Database, ArrowRight, Cloud, ShieldCheck, Activity } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { HostingDeploymentsView } from "./hosting-deployments-view"
import { DatabaseStorageView } from "./database-storage-view"
import { EnvironmentView } from "./environment-view"

type TabKey = "overview" | "hosting" | "domains" | "environment" | "database"

interface NavItem {
  key: TabKey
  label: string
  description: string
  icon: typeof Server
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    description: "Ringkasan & status sistem",
    icon: Server,
  },
  {
    key: "hosting",
    label: "Hosting",
    description: "Vercel & VPS deployment",
    icon: Rocket,
  },
  {
    key: "domains",
    label: "Domains",
    description: "Custom domain & verifikasi DNS",
    icon: Globe,
  },
  {
    key: "environment",
    label: "Environment",
    description: "Variabel build frontend",
    icon: Variable,
  },
  {
    key: "database",
    label: "Database & Storage",
    description: "PostgreSQL & Object Storage",
    icon: Database,
  },
]

const OVERVIEW_CARDS: { key: Exclude<TabKey, "overview">; title: string; desc: string; icon: typeof Server }[] = [
  { key: "hosting", title: "Hosting & Deployment", desc: "Status deployment frontend Vercel & VPS, logs, dan URL live.", icon: Rocket },
  { key: "domains", title: "Custom Domains", desc: "Kelola domain kustom, sertifikat SSL, dan diagnostik verifikasi DNS.", icon: Globe },
  { key: "environment", title: "Environment Variables", desc: "Konfigurasi variabel build aman untuk frontend Next.js.", icon: Variable },
  { key: "database", title: "Database & Storage", desc: "Akses PostgreSQL, S3/MinIO bucket, dan dedicated cluster.", icon: Database },
]

function InfrastructureShell() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenantSlug = params?.tenant as string

  const urlTab = searchParams.get("tab") as TabKey | null
  const [tab, setTab] = useState<TabKey>(
    urlTab && NAV_ITEMS.some((t) => t.key === urlTab) ? urlTab : "overview",
  )

  // Keep ?tab= in the URL so tabs are linkable/shareable and the
  // /deployments and /domains redirects land on the right one.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (tab === "overview") url.searchParams.delete("tab")
    else url.searchParams.set("tab", tab)
    window.history.replaceState({}, "", url.toString())
  }, [tab])

  // Keep the heavy sub-views mounted once visited so their fetched state
  // survives tab switches.
  const [mounted, setMounted] = useState<Record<string, boolean>>({})
  useEffect(() => {
    setMounted((m) => {
      if (tab === "hosting" || tab === "domains") return m.hosting ? m : { ...m, hosting: true }
      if (tab === "environment") return m.environment ? m : { ...m, environment: true }
      if (tab === "database") return m.database ? m : { ...m, database: true }
      return m
    })
  }, [tab])

  const hostingSection = useMemo<"hosting" | "domains">(() => (tab === "domains" ? "domains" : "hosting"), [tab])

  const currentNav = useMemo(() => NAV_ITEMS.find((n) => n.key === tab) || NAV_ITEMS[0], [tab])

  return (
    <div className="flex flex-1 flex-col w-full min-h-[calc(100vh-4rem)]">
      {/* Top Banner Header */}
      <div className="border-b border-border/70 bg-card/40 backdrop-blur-xs px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">
                  Hosting &amp; Infrastruktur
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                  Cloud Management
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pusat kendali hosting, domain kustom, variabel environment, dan koneksi database.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Edge Gateway Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Sub-Sidebar + Content Pane */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Mobile / Tablet Horizontal Navigation (< md) */}
        <div className="md:hidden border-b border-border/70 bg-card/30 p-2 overflow-x-auto flex gap-1.5 scrollbar-none">
          {NAV_ITEMS.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        {/* Sub-Sidebar (Desktop md:flex) */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col shrink-0 border-r border-border/70 bg-card/25 p-4 lg:p-6 space-y-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 px-2.5 mb-2.5">
              Menu Infrastruktur
            </div>
            <nav className="space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const active = tab === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => setTab(item.key)}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-xs transition-all text-left group cursor-pointer",
                      active
                        ? "bg-primary text-primary-foreground font-bold shadow-xs shadow-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    <div
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        active
                          ? "bg-primary-foreground/15 text-primary-foreground"
                          : "bg-muted/80 text-muted-foreground group-hover:text-foreground group-hover:bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-xs leading-tight">{item.label}</div>
                      <div
                        className={cn(
                          "text-[10px] truncate mt-0.5",
                          active ? "text-primary-foreground/80" : "text-muted-foreground/70"
                        )}
                      >
                        {item.description}
                      </div>
                    </div>
                    {active && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground shrink-0" />
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Mini Infrastructure Info Widget at bottom of sub-sidebar */}
          <div className="mt-auto pt-4 border-t border-border/60">
            <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-foreground text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5 text-primary" />
                  Cluster Engine
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Anycast v2</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Terkoneksi ke isolated DNS proxy, PostgreSQL database pool, dan edge reverse proxy.
              </p>
            </div>
          </div>
        </aside>

        {/* Right Content Pane */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Section Breadcrumb/Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <currentNav.icon className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground leading-tight">{currentNav.label}</h2>
                <p className="text-xs text-muted-foreground">{currentNav.description}</p>
              </div>
            </div>
          </div>

          {/* Tab 1: Overview */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">Pilih Layanan Infrastruktur</h3>
                <p className="text-xs text-muted-foreground">
                  Kelola setiap komponen infrastruktur aplikasi dan website Anda dengan memilih modul di bawah:
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {OVERVIEW_CARDS.map((c) => (
                  <Card
                    key={c.key}
                    onClick={() => setTab(c.key)}
                    className="rounded-2xl border border-border/80 shadow-xs cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group bg-card"
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-105">
                          <c.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                            {c.title}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {c.desc}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2 & 3: Hosting + Domains */}
          <div hidden={tab !== "hosting" && tab !== "domains"}>
            {mounted.hosting && (
              <HostingDeploymentsView
                tenantSlug={tenantSlug}
                visibleSection={hostingSection}
                onNavigate={(t) => setTab(t as TabKey)}
              />
            )}
          </div>

          {/* Tab 4: Environment */}
          <div hidden={tab !== "environment"}>
            {mounted.environment && <EnvironmentView tenantSlug={tenantSlug} />}
          </div>

          {/* Tab 5: Database & Storage */}
          <div hidden={tab !== "database"}>
            {mounted.database && <DatabaseStorageView tenantSlug={tenantSlug} />}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function TenantInfrastructurePage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-10 w-full max-w-md rounded-xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      }
    >
      <InfrastructureShell />
    </Suspense>
  )
}
