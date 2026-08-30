"use client"

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import "swagger-ui-react/swagger-ui.css"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  FileDown, ExternalLink, Key, Terminal, 
  Code2, Sparkles, Database, Layers, ArrowRight 
} from "lucide-react"
import Link from "next/link"
import { Skeleton } from "@/components/ui/skeleton"

// Import swagger UI dynamically to avoid SSR issues with window object
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { 
  ssr: false,
  loading: () => (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="space-y-3">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="space-y-4 pt-4">
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  )
})

export default function APIDocsPage() {
  const params = useParams()
  const tenantSlug = params?.tenant as string

  if (!tenantSlug) return null

  // The dynamic OpenAPI JSON generator endpoint
  const specUrl = `/api/tenant/${tenantSlug}/developer/openapi`

  return (
    <div className="flex-1 bg-background min-h-screen text-foreground">
      {/* Top Header */}
      <div className="border-b border-border/60 bg-card/60 backdrop-blur-md px-6 py-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                Dokumentasi API Interaktif
              </h1>
              <Badge variant="outline" className="font-bold text-[10px] uppercase rounded-full bg-primary/10 text-primary border-primary/30">
                OpenAPI 3.0
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-medium">
              Eksplorasi dan uji coba REST API publik untuk seluruh skema di workspace <span className="font-mono font-bold text-foreground">/{tenantSlug}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-9 text-xs font-bold border-border/80 text-foreground hover:bg-muted shadow-xs gap-1.5"
              asChild
            >
              <a href={specUrl} target="_blank" rel="noreferrer" download={`openapi-${tenantSlug}.json`}>
                <FileDown className="h-3.5 w-3.5 text-primary" />
                <span>Unduh OpenAPI JSON</span>
              </a>
            </Button>
            <Button
              size="sm"
              className="rounded-xl h-9 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs gap-1.5"
              asChild
            >
              <Link href={`/dashboard/${tenantSlug}/developer/api-keys`}>
                <Key className="h-3.5 w-3.5" />
                <span>Kelola API Token</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Link href={`/dashboard/${tenantSlug}/developer/api`}>
            <Card className="rounded-2xl border border-border/70 hover:border-primary/50 transition-colors shadow-xs bg-card group cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">REST API Sandbox</h3>
                    <p className="text-[11px] text-muted-foreground">Uji coba request langsung dengan response live</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${tenantSlug}/developer/graphql`}>
            <Card className="rounded-2xl border border-border/70 hover:border-primary/50 transition-colors shadow-xs bg-card group cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">GraphQL Explorer</h3>
                    <p className="text-[11px] text-muted-foreground">Query dan mutasi dengan GraphiQL sandbox</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </CardContent>
            </Card>
          </Link>

          <Link href={`/dashboard/${tenantSlug}/developer/sdk`}>
            <Card className="rounded-2xl border border-border/70 hover:border-primary/50 transition-colors shadow-xs bg-card group cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Code2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">TypeScript SDK</h3>
                    <p className="text-[11px] text-muted-foreground">Integrasi klien type-safe untuk Next.js & Astro</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Swagger UI Container */}
        <div className="bg-white dark:bg-slate-950 border border-border/80 shadow-xs rounded-2xl overflow-hidden p-2 md:p-4">
          <SwaggerUI url={specUrl} />
        </div>
      </div>
    </div>
  )
}
