"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { Server, Rocket, Globe, Variable, Database, Cloud, Activity, Cpu, Zap, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { HostingDeploymentsView } from "./hosting-deployments-view"
import { DatabaseStorageView } from "./database-storage-view"
import { EnvironmentView } from "./environment-view"

type TabKey = "hosting" | "domains" | "database" | "environment"

interface NavItem {
  key: TabKey
  label: string
  description: string
  icon: typeof Server
}

const NAV_ITEMS: NavItem[] = [
  {
    key: "hosting",
    label: "Deployments & Hosting",
    description: "Status deploy Vercel & VPS, logs, dan URL live",
    icon: Rocket,
  },
  {
    key: "domains",
    label: "Custom Domains & DNS",
    description: "Kelola domain kustom, SSL, & diagnostik DNS",
    icon: Globe,
  },
  {
    key: "database",
    label: "Database & Storage",
    description: "PostgreSQL & Object Storage MinIO/S3",
    icon: Database,
  },
  {
    key: "environment",
    label: "Environment Variables",
    description: "Variabel build aman untuk frontend Next.js",
    icon: Variable,
  },
]

function InfrastructureShell() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tenantSlug = params?.tenant as string

  const urlTab = searchParams.get("tab")

  // Auto redirect legacy static-site URL to AI Website Builder in Developer Portal
  useEffect(() => {
    if (urlTab === "static-site" && tenantSlug) {
      router.replace(`/dashboard/${tenantSlug}/developer/aiwebsitebuilder`)
    }
  }, [urlTab, tenantSlug, router])

  const [tab, setTab] = useState<TabKey>(() => {
    if (urlTab === "domains") return "domains"
    if (urlTab === "database") return "database"
    if (urlTab === "environment") return "environment"
    return "hosting"
  })

  // Synchronize ?tab= query parameter in URL
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set("tab", tab)
    window.history.replaceState({}, "", url.toString())
  }, [tab])

  // Keep heavy sub-views mounted once visited so state survives tab switching
  const [mounted, setMounted] = useState<Record<string, boolean>>({ hosting: true })
  useEffect(() => {
    setMounted((m) => {
      if (tab === "hosting" || tab === "domains") return m.hosting ? m : { ...m, hosting: true }
      if (tab === "environment") return m.environment ? m : { ...m, environment: true }
      if (tab === "database") return m.database ? m : { ...m, database: true }
      return m
    })
  }, [tab])

  // Live telemetry summary
  const [telemetry, setTelemetry] = useState({
    hostingStatus: "Live di Vercel",
    domainsCount: 1,
    databaseType: "PostgreSQL 17",
    envCount: 0,
  })

  useEffect(() => {
    if (!tenantSlug) return
    Promise.all([
      fetch(`/api/tenant/${tenantSlug}/settings`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/tenant/${tenantSlug}/environment`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/tenant/${tenantSlug}/infrastructure`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([settingsData, envData, infraData]) => {
        const s = settingsData?.settings
        const hasDb = Boolean(s?.databaseUrl)
        const envKeys = envData?.variables ? Object.keys(envData.variables).length : 0
        setTelemetry({
          hostingStatus: infraData?.deployment?.url ? "Live di Vercel" : "Siap Dideploy",
          domainsCount: infraData?.domains?.length || 1,
          databaseType: hasDb ? "Dedicated VPS / BYODB" : "Shared PostgreSQL 17",
          envCount: envKeys,
        })
      })
      .catch(() => {})
  }, [tenantSlug])

  const hostingSection = useMemo<"hosting" | "domains">(() => (tab === "domains" ? "domains" : "hosting"), [tab])

  return (
    <div className="flex flex-1 flex-col w-full min-h-[calc(100vh-4rem)] bg-background">
      {/* Top Banner Header */}
      <div className="border-b border-border/70 bg-card/40 backdrop-blur-xs px-4 md:px-6 lg:px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl lg:text-2xl font-black tracking-tight text-foreground">
                  Hosting &amp; Infrastruktur
                </h1>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider text-primary border-primary/30 bg-primary/5">
                  Cloud Management
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pusat kendali deployment frontend, manajemen domain kustom, variabel environment, dan koneksi database.
              </p>
            </div>
          </div>

          {/* Telemetry Status Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Edge Gateway Online</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60 text-muted-foreground text-xs font-medium">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              <span>{telemetry.hostingStatus}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60 text-muted-foreground text-xs font-medium">
              <Database className="h-3.5 w-3.5 text-primary" />
              <span>{telemetry.databaseType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Horizontal Navigation Bar (Full-Width, No Cramped Double Sidebar) */}
      <div className="border-b border-border/70 bg-card/25 px-4 md:px-6 lg:px-8 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1">
            {NAV_ITEMS.map((item) => {
              const active = tab === item.key
              return (
                <button
                  key={item.key}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold whitespace-nowrap transition-all cursor-pointer group",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  <span>{item.label}</span>
                  {item.key === "domains" && telemetry.domainsCount > 0 && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] h-4 px-1 rounded-full font-bold ml-0.5",
                      active ? "border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground" : "border-border text-muted-foreground"
                    )}>
                      {telemetry.domainsCount}
                    </Badge>
                  )}
                  {item.key === "environment" && telemetry.envCount > 0 && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] h-4 px-1 rounded-full font-bold ml-0.5",
                      active ? "border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground" : "border-border text-muted-foreground"
                    )}>
                      {telemetry.envCount}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>

          {/* Quick link to AI Website Builder in Developer Portal */}
          <button
            onClick={() => router.push(`/dashboard/${tenantSlug}/developer/aiwebsitebuilder`)}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold transition-all shrink-0 cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>AI Instant Website</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
          </button>
        </div>
      </div>

      {/* Main Full-Width Content Pane */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* Tab 1: Hosting */}
        <div hidden={tab !== "hosting"}>
          {mounted.hosting && (
            <HostingDeploymentsView
              tenantSlug={tenantSlug}
              visibleSection="hosting"
              onNavigate={(t) => setTab(t as TabKey)}
            />
          )}
        </div>

        {/* Tab 2: Domains */}
        <div hidden={tab !== "domains"}>
          {mounted.hosting && (
            <HostingDeploymentsView
              tenantSlug={tenantSlug}
              visibleSection="domains"
              onNavigate={(t) => setTab(t as TabKey)}
            />
          )}
        </div>

        {/* Tab 3: Database & Storage */}
        <div hidden={tab !== "database"}>
          {mounted.database && <DatabaseStorageView tenantSlug={tenantSlug} />}
        </div>

        {/* Tab 4: Environment */}
        <div hidden={tab !== "environment"}>
          {mounted.environment && <EnvironmentView tenantSlug={tenantSlug} />}
        </div>
      </main>
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
