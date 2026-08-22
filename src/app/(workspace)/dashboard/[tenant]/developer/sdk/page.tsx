"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BookOpen, Copy, Check, Package, Terminal,
  Code2, FileCode, Play, Sparkles, Layers,
  Database, Shield, CheckCircle2, ArrowRight, Wand2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function SdkDocsPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [copiedBlock, setCopiedBlock] = useState<string | null>(null)
  const [origin, setOrigin] = useState("http://localhost:3000")
  const [packageManager, setPackageManager] = useState<"npm" | "pnpm" | "yarn" | "bun">("npm")

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return null
  }

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

  const CodeBlock = ({ 
    code, 
    id, 
    lang = "typescript",
    title
  }: { 
    code: string
    id: string
    lang?: string
    title?: string 
  }) => (
    <div className="rounded-xl border border-border/80 bg-neutral-950 text-neutral-100 overflow-hidden shadow-xs">
      {title && (
        <div className="px-4 py-2 bg-neutral-900/90 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-700" />
            </div>
            <span className="text-[11px] font-mono text-neutral-400">{title}</span>
          </div>
          <span className="text-[10px] font-mono uppercase text-neutral-500">{lang}</span>
        </div>
      )}
      <div className="relative group p-4 font-mono text-xs">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-3 h-7 text-[11px] font-bold text-neutral-400 hover:text-white bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-700/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => handleCopy(code, id)}
        >
          {copiedBlock === id ? (
            <Check className="h-3 w-3 mr-1 text-emerald-400" />
          ) : (
            <Copy className="h-3 w-3 mr-1" />
          )}
          {copiedBlock === id ? "Tersalin!" : "Salin"}
        </Button>
        <pre className="overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
      </div>
    </div>
  )

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
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  SDK & Integrasi Developer
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold rounded-full">
                  @sacms/sdk v1.0
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Panduan integrasi resmi TypeScript SDK, REST API cURL endpoints, dan antarmuka tipe data type-safe untuk aplikasi Next.js & Frontend.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 rounded-xl text-xs font-bold border-border/80"
                asChild
              >
                <a href={`/dashboard/${tenantSlug}/developer/api`}>
                  <Play className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  REST Explorer
                </a>
              </Button>

              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 rounded-xl text-xs font-bold border-border/80"
                asChild
              >
                <a href={`/dashboard/${tenantSlug}/developer/mcp`}>
                  <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
                  MCP Server
                </a>
              </Button>
            </div>
          </div>

          {/* Quick Config Banner */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-primary" />
                  Parameter Dasar Workspace ({tenantSlug})
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Konfigurasi endpoint dan slug yang digunakan oleh SDK dan REST client.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold border-border/80 shrink-0"
                asChild
              >
                <a href={`/dashboard/${tenantSlug}/developer/api-keys`}>
                  Kelola API Key &rarr;
                </a>
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

          {/* Main Tabs */}
          <Tabs defaultValue="sdk" className="space-y-6">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-2xl grid grid-cols-3 max-w-lg h-auto gap-1">
              <TabsTrigger value="sdk" className="rounded-xl font-bold text-xs py-2">
                <Package className="h-3.5 w-3.5 mr-1.5" />
                TypeScript SDK
              </TabsTrigger>
              <TabsTrigger value="rest" className="rounded-xl font-bold text-xs py-2">
                <Terminal className="h-3.5 w-3.5 mr-1.5" />
                REST API HTTP
              </TabsTrigger>
              <TabsTrigger value="types" className="rounded-xl font-bold text-xs py-2">
                <FileCode className="h-3.5 w-3.5 mr-1.5" />
                TypeScript Types
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SDK */}
            <TabsContent value="sdk" className="space-y-6">
              
              {/* Installation */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      1. Instalasi SDK
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Pasang library client resmi SaCMS ke project Next.js, Node.js, atau frontend Anda.
                    </CardDescription>
                  </div>

                  {/* Package manager toggle */}
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
                <CardContent className="p-5">
                  <CodeBlock 
                    id="install" 
                    title="Terminal"
                    lang="bash" 
                    code={getInstallCommand(packageManager)} 
                  />
                </CardContent>
              </Card>

              {/* Initialization */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">
                    2. Inisialisasi Klien (Client Setup)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Buat instance klien SaCMS dengan kredensial workspace Anda.
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
  locale: 'en', // default locale
})`} 
                  />
                </CardContent>
              </Card>

              {/* Query Fluent Builder */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">
                    3. Pengambilan Data Entri (Fluent Query Builder)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Mengambil koleksi data dengan chaining method yang ekspresif, type-safe, dan otomatis menangani filter.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <CodeBlock 
                    id="findMany" 
                    title="app/blog/page.tsx"
                    code={`// Mengambil daftar artikel dengan filtering, sorting, dan populate relasi
const articles = await cms.collection('articles')
  .query()
  .where('category', 'eq', 'tech')
  .search('nextjs')
  .populate(['author'])
  .sort('createdAt', 'desc')
  .page(1)
  .limit(20)
  .fetch()

console.log(articles.data) // Array entri artikel
console.log(articles.meta.pagination) // { page: 1, pageSize: 20, total: 3, totalPages: 1 }`} 
                  />
                </CardContent>
              </Card>

              {/* Single Entry & Single Type */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">
                      Ambil 1 Entri Koleksi (Find One)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <CodeBlock 
                      id="findOne" 
                      code={`const article = await cms.collection('articles').findOne('entry_id')

console.log(article.data.title)`} 
                    />
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                  <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                    <CardTitle className="text-sm font-bold text-foreground">
                      Halaman Statis (Single Type)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <CodeBlock 
                      id="single" 
                      code={`// Ambil konfigurasi halaman utama
const homepage = await cms.single('homepage-config').find({
  locale: 'en',
})

console.log(homepage.data)`} 
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Data Mutation CRUD */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">
                    4. Mutasi Data (Create, Update, Delete)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Membuat, memperbarui, atau menghapus entri konten (memerlukan API key dengan izin Write).
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <CodeBlock 
                    id="mutations" 
                    title="app/actions.ts"
                    code={`// 1. Buat entri baru
const newArticle = await cms.collection('articles').create({
  data: {
    title: 'Tips Optimasi Next.js 16',
    author: 'Admin',
    content: '<p>Panduan lengkap performa...</p>',
    status: 'PUBLISHED',
  }
})

// 2. Update entri berdasarkan ID
await cms.collection('articles').update(newArticle.data.id, {
  data: {
    title: 'Tips Optimasi Next.js 16 (Updated)',
  }
})

// 3. Hapus entri berdasarkan ID
await cms.collection('articles').delete(newArticle.data.id)`} 
                  />
                </CardContent>
              </Card>

              {/* Raw GraphQL */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground">
                    5. Eksekusi Raw GraphQL Query
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Kueri GraphQL dinamis dengan nested field selection.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <CodeBlock 
                    id="graphql" 
                    code={`const response = await cms.graphql(\`
  query GetArticles {
    articles(page: 1, pageSize: 10) {
      data {
        id
        title
        author
        createdAt
      }
      meta {
        pagination {
          total
        }
      }
    }
  }
\`)`} 
                  />
                </CardContent>
              </Card>

            </TabsContent>

            {/* TAB 2: REST API */}
            <TabsContent value="rest" className="space-y-6">
              
              {/* Base Endpoint & Header Card */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Format Autentikasi Request cURL
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Sertakan header Bearer Token pada setiap pemanggilan HTTP API publik.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  <CodeBlock 
                    id="rest-auth" 
                    lang="bash" 
                    title="cURL Request"
                    code={`curl -X GET "${origin}/api/public/${tenantSlug}/content/articles" \\
  -H "Authorization: Bearer cf_your_api_key_here" \\
  -H "Content-Type: application/json"`} 
                  />
                </CardContent>
              </Card>

              {/* Endpoint Samples */}
              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "GET Koleksi Entri (dengan Filter)",
                    desc: "Mengambil entri dengan filter kategori, pagination, dan relasi",
                    code: `GET /api/public/${tenantSlug}/content/articles
  ?filters[category][$eq]=tech
  &fields=title,slug,price
  &populate=author
  &sort=createdAt:desc
  &page=1&pageSize=25`,
                  },
                  {
                    title: "GET Satu Entri Spesifik",
                    desc: "Mengambil entri detail berdasarkan ID",
                    code: `GET /api/public/${tenantSlug}/content/articles/{id}
  ?populate=*`,
                  },
                  {
                    title: "Pencarian Teks Full-Text",
                    desc: "Pencarian cepat di semua teks terindeks",
                    code: `GET /api/public/${tenantSlug}/content/articles
  ?search=nextjs+tutorial`,
                  },
                  {
                    title: "GET Data Single Type",
                    desc: "Mengambil data konten halaman tunggal (Homepage / Settings)",
                    code: `GET /api/public/${tenantSlug}/single/homepage-config
  ?locale=en`,
                  },
                ].map((sample, idx) => (
                  <Card key={idx} className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                    <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                      <CardTitle className="text-xs font-bold text-foreground">{sample.title}</CardTitle>
                      <CardDescription className="text-[11px] text-muted-foreground mt-0.5">{sample.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="p-5">
                      <CodeBlock id={`sample-${idx}`} lang="http" code={sample.code} />
                    </CardContent>
                  </Card>
                ))}
              </div>

            </TabsContent>

            {/* TAB 3: TYPES */}
            <TabsContent value="types" className="space-y-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <FileCode className="h-4 w-4 text-primary" />
                    Type Safety & IntelliSense dengan TypeScript
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Definisi antarmuka tipe data TypeScript untuk struktur payload dan entri skema CMS.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <CodeBlock 
                    id="types-def" 
                    title="types/sacms.ts"
                    code={`// Format respon standar API SaCMS
export interface SaCMSResponse<T> {
  data: T[]
  meta: {
    contentType: {
      name: string
      slug: string
    }
    pagination: {
      page: number
      pageSize: number
      total: number
      totalPages: number
    }
  }
}

// Definisi antarmuka Single Type
export interface SaCMSSingleResponse<T> {
  data: T & {
    publishedAt: string | null
    updatedAt: string
  }
  meta: {
    singleType: {
      name: string
      slug: string
    }
    locale: string
  }
}

// Definisi model entri spesifik
export interface Article {
  id: string
  title: string
  slug?: string
  author?: string
  content?: string
  excerpt?: string
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED'
  locale: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}`} 
                  />
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

        </div>
      </div>
    </div>
  )
}
