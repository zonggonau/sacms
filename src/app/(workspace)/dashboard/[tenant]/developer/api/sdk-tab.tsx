"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Package, Terminal, FileCode, Copy, Check, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface SdkTabProps {
  tenantSlug: string
}

export function SdkTab({ tenantSlug }: SdkTabProps) {
  const { toast } = useToast()
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null)
  const [packageManager, setPackageManager] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm")
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedBlock(id)
      setTimeout(() => setCopiedBlock(null), 2000)
      toast({ title: "Tersalin!", description: "Kode berhasil disalin ke clipboard." })
    } catch {
      toast({ variant: "destructive", title: "Gagal menyalin" })
    }
  }

  /* eslint-disable no-restricted-syntax -- CodeBlock renders a deliberate always-dark code window, like docs-client.tsx's CodeBlock. */
  const CodeBlock = ({
    code,
    id,
    title
  }: {
    code: string
    id: string
    title?: string
  }) => (
    <div className="rounded-xl border border-border/80 bg-neutral-950 text-neutral-100 overflow-hidden shadow-xs">
      {title && (
        <div className="px-4 py-2 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <span className="text-[11px] font-mono font-semibold text-neutral-300">{title}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] font-bold text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md"
            onClick={() => handleCopy(code, id)}
          >
            {copiedBlock === id ? (
              <span className="flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" /> Tersalin</span>
            ) : (
              <span className="flex items-center gap-1"><Copy className="h-3 w-3" /> Salin</span>
            )}
          </Button>
        </div>
      )}
      <div className="relative group p-4 font-mono text-xs overflow-x-auto">
        {!title && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 h-7 text-[11px] font-bold text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => handleCopy(code, id)}
          >
            {copiedBlock === id ? <Check className="h-3 w-3 mr-1 text-emerald-400" /> : <Copy className="h-3 w-3 mr-1" />}
            {copiedBlock === id ? "Tersalin!" : "Salin"}
          </Button>
        )}
        <pre className="whitespace-pre leading-relaxed">{code}</pre>
      </div>
    </div>
  )
  /* eslint-enable no-restricted-syntax */

  const getInstallCommand = (pm: string) => {
    switch (pm) {
      case "pnpm":
        return "pnpm add @sacms/sdk"
      case "yarn":
        return "yarn add @sacms/sdk"
      case "bun":
        return "bun add @sacms/sdk"
      default:
        return "npm install @sacms/sdk"
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Quick Config Banner */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Parameter Integrasi ({tenantSlug})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              URL dasar dan identifier workspace untuk client SDK & REST fetch.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold border-border/80 shrink-0" asChild>
            <Link href={`/dashboard/${tenantSlug}/developer/api-keys`}>
              <Key className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Kelola API Token
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-foreground">API Base URL:</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted/30 px-2.5 py-1.5 rounded-xl border border-border/60 flex-1 truncate">
                {origin}/api/public/{tenantSlug}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(`${origin}/api/public/${tenantSlug}`, "banner-url")}
                className="h-8 rounded-xl text-xs font-bold"
              >
                {copiedBlock === "banner-url" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-foreground">Workspace Tenant Slug:</span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted/30 px-2.5 py-1.5 rounded-xl border border-border/60 flex-1 truncate font-bold text-primary">
                {tenantSlug}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(tenantSlug, "banner-slug")}
                className="h-8 rounded-xl text-xs font-bold"
              >
                {copiedBlock === "banner-slug" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub Tabs */}
      <Tabs defaultValue="sdk" className="space-y-6">
        <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-3 max-w-md h-auto gap-1">
          <TabsTrigger value="sdk" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
            <Package className="h-3.5 w-3.5 mr-1.5" />
            TypeScript SDK
          </TabsTrigger>
          <TabsTrigger value="fetch" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
            <Terminal className="h-3.5 w-3.5 mr-1.5" />
            Native Fetch
          </TabsTrigger>
          <TabsTrigger value="react" className="rounded-xl font-bold text-xs py-2 text-muted-foreground hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xs">
            <FileCode className="h-3.5 w-3.5 mr-1.5" />
            React Hooks
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SDK */}
        <TabsContent value="sdk" className="space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  1. Instalasi SDK
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Pasang library client SaCMS ke project Next.js atau Node.js Anda.
                </CardDescription>
              </div>

              <div className="flex bg-muted/50 p-0.5 rounded-xl border border-border/60 text-[11px] font-bold">
                {(["npm", "pnpm", "yarn", "bun"] as const).map((pm) => (
                  <button
                    key={pm}
                    onClick={() => setPackageManager(pm)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      packageManager === pm
                        ? "bg-background text-foreground shadow-xs font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <CodeBlock
                id="install"
                title="Terminal"
                code={getInstallCommand(packageManager)}
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">
                2. Inisialisasi Klien (Client Setup)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Konfigurasi instance SaCMS dengan token API workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <CodeBlock 
                id="init" 
                title="lib/sacms.ts"
                code={`import { SaCMS } from '@sacms/sdk'

export const cms = new SaCMS({
  baseUrl: '${origin}',
  tenant: '${tenantSlug}',
  token: process.env.SACMS_API_KEY || 'cf_your_api_key_here',
  locale: 'id',
})`} 
              />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">
                3. Mengambil Data Koleksi (Fluent Query Builder)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Chaining method type-safe untuk filtering, sorting, pagination, dan populate relasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <CodeBlock 
                id="findMany" 
                title="app/blog/page.tsx"
                code={`// Ambil daftar artikel dengan filter & relasi
const articles = await cms.collection('articles')
  .query()
  .where('status', 'eq', 'PUBLISHED')
  .populate(['author', 'category'])
  .sort('createdAt:desc')
  .page(1)
  .limit(10)
  .fetch()

console.log(articles.data) // Array entri artikel
console.log(articles.meta.pagination) // { page: 1, pageSize: 10, total: 25 }`} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Native Fetch */}
        <TabsContent value="fetch" className="space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">
                Native Fetch (Tanpa Dependency)
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Contoh pemanggilan API langsung menggunakan HTTP fetch standar modern.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <CodeBlock 
                id="native-fetch" 
                title="utils/api.ts"
                code={`async function getEntries(contentType: string) {
  const res = await fetch('${origin}/api/public/${tenantSlug}/content/' + contentType + '?limit=10', {
    headers: {
      'Authorization': 'Bearer ' + process.env.SACMS_API_KEY,
      'Content-Type': 'application/json'
    },
    next: { revalidate: 60 } // Next.js ISR cache
  })

  if (!res.ok) throw new Error('Failed to fetch content')
  return res.json()
}`} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: React Hooks */}
        <TabsContent value="react" className="space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <CardTitle className="text-sm font-bold text-foreground">
                React SWR / TanStack Query Hook
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Integrasi hooks client-side dengan cache otomatis dan revalidasi background.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <CodeBlock 
                id="react-hook" 
                title="hooks/use-content.ts"
                code={`import useSWR from 'swr'

const fetcher = (url: string) => 
  fetch(url, { 
    headers: { 'Authorization': 'Bearer ' + process.env.NEXT_PUBLIC_SACMS_API_KEY } 
  }).then(r => r.json())

export function useArticles() {
  const { data, error, isLoading } = useSWR(
    '${origin}/api/public/${tenantSlug}/content/articles',
    fetcher
  )

  return {
    articles: data?.data ?? [],
    pagination: data?.meta?.pagination,
    isLoading,
    isError: error
  }
}`} 
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
