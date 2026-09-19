"use client"

import { useState } from "react"
import { Copy, Check, Code2, Terminal, BookOpen, ExternalLink, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface ApiSnippetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantSlug: string
  contentTypeSlug: string
  contentTypeName?: string
  fields?: Array<{ name: string; slug: string; type: string }>
}

export function ApiSnippetDialog({
  open,
  onOpenChange,
  tenantSlug,
  contentTypeSlug,
  contentTypeName = "Content",
  fields = []
}: ApiSnippetDialogProps) {
  const { toast } = useToast()
  const [copiedTab, setCopiedTab] = useState<string | null>(null)

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const apiUrl = `${origin}/api/public/${tenantSlug}/content/${contentTypeSlug}`
  const graphqlUrl = `${origin}/api/public/${tenantSlug}/graphql`

  // Field selection for examples
  const sampleFields = fields.length > 0 
    ? fields.slice(0, 4).map(f => f.slug) 
    : ["title", "slug", "content", "publishedAt"]

  // Code snippets
  const restCode = `// 1. Fetch data dari Public REST API
const res = await fetch("${apiUrl}?page=1&limit=10&status=PUBLISHED", {
  headers: {
    // Masukkan API token jika konten diatur privat / butuh proteksi
    // "Authorization": "Bearer sec_your_api_key"
  },
  next: { revalidate: 60 } // Next.js ISR Caching (Opsional)
});

const data = await res.json();
console.log("Data Entri:", data.data);
console.log("Meta Pagination:", data.meta);`

  const sdkCode = `import { SacmsClient } from "@sacms/sdk";

const sacms = new SacmsClient({
  baseUrl: "${origin}",
  tenant: "${tenantSlug}",
  // apiKey: process.env.SACMS_API_KEY
});

// Ambil daftar entri ${contentTypeSlug}
const entries = await sacms.content.findMany("${contentTypeSlug}", {
  page: 1,
  limit: 10,
  filters: {
    status: { $eq: "PUBLISHED" }
  }
});

console.log(entries.data);`

  const graphqlCode = `query Get${contentTypeSlug.replace(/[^a-zA-Z0-9]/g, '')}Entries {
  ${contentTypeSlug}(page: 1, limit: 10, filter: { status: { eq: "PUBLISHED" } }) {
    nodes {
      id
      status
      createdAt
      data
    }
    totalCount
    pageInfo {
      hasNextPage
      totalPages
    }
  }
}`

  const curlCode = `# Ambil entri publik via cURL
curl -X GET "${apiUrl}?page=1&limit=10" \\
  -H "Accept: application/json"`

  const handleCopy = (code: string, tabName: string) => {
    navigator.clipboard.writeText(code)
    setCopiedTab(tabName)
    toast({ title: "Tersalin", description: `Kode ${tabName} telah disalin ke clipboard.` })
    setTimeout(() => setCopiedTab(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/80 shadow-2xl bg-card sm:max-w-[760px] md:max-w-[820px] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 pr-12 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-sm font-bold flex items-center gap-2">
                  Integrasi API: {contentTypeName}
                  <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase border-primary/20 text-primary">
                    /{contentTypeSlug}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Contoh implementasi siap pakai untuk frontend Anda (Next.js, Astro, Nuxt, Mobile).
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 pt-3 space-y-4 overflow-y-auto flex-1">
          <Tabs defaultValue="rest" className="w-full">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-xl w-full grid grid-cols-4">
              <TabsTrigger value="rest" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                REST API
              </TabsTrigger>
              <TabsTrigger value="sdk" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                TypeScript SDK
              </TabsTrigger>
              <TabsTrigger value="graphql" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                GraphQL
              </TabsTrigger>
              <TabsTrigger value="curl" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                cURL
              </TabsTrigger>
            </TabsList>

            {/* REST Tab */}
            <TabsContent value="rest" className="mt-3 space-y-2">
              <div className="relative group">
                <div className="p-4 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl font-mono text-[11px] overflow-x-auto overflow-y-auto max-h-80 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre min-w-max">{restCode}</pre>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(restCode, "REST API")}
                  className="absolute top-3 right-3 h-7 px-2.5 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 cursor-pointer shadow-xs"
                >
                  {copiedTab === "REST API" ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedTab === "REST API" ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 overflow-x-auto">
                <span className="truncate">Endpoint: <code className="text-primary font-mono select-all">{apiUrl}</code></span>
              </div>
            </TabsContent>

            {/* SDK Tab */}
            <TabsContent value="sdk" className="mt-3 space-y-2">
              <div className="relative group">
                <div className="p-4 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl font-mono text-[11px] overflow-x-auto overflow-y-auto max-h-80 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre min-w-max">{sdkCode}</pre>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(sdkCode, "TypeScript SDK")}
                  className="absolute top-3 right-3 h-7 px-2.5 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 cursor-pointer shadow-xs"
                >
                  {copiedTab === "TypeScript SDK" ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedTab === "TypeScript SDK" ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground px-1">
                Install SDK via terminal: <code className="text-primary font-mono bg-muted/40 px-1.5 py-0.5 rounded">bun add @sacms/sdk</code>
              </p>
            </TabsContent>

            {/* GraphQL Tab */}
            <TabsContent value="graphql" className="mt-3 space-y-2">
              <div className="relative group">
                <div className="p-4 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl font-mono text-[11px] overflow-x-auto overflow-y-auto max-h-80 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre min-w-max">{graphqlCode}</pre>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(graphqlCode, "GraphQL")}
                  className="absolute top-3 right-3 h-7 px-2.5 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 cursor-pointer shadow-xs"
                >
                  {copiedTab === "GraphQL" ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedTab === "GraphQL" ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 overflow-x-auto">
                <span className="truncate">GraphQL Playground: <code className="text-primary font-mono select-all">{graphqlUrl}</code></span>
              </div>
            </TabsContent>

            {/* cURL Tab */}
            <TabsContent value="curl" className="mt-3 space-y-2">
              <div className="relative group">
                <div className="p-4 bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl font-mono text-[11px] overflow-x-auto overflow-y-auto max-h-80 leading-relaxed shadow-inner">
                  <pre className="whitespace-pre min-w-max">{curlCode}</pre>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopy(curlCode, "cURL")}
                  className="absolute top-3 right-3 h-7 px-2.5 text-[10px] font-bold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 cursor-pointer shadow-xs"
                >
                  {copiedTab === "cURL" ? <Check className="w-3 h-3 mr-1 text-emerald-400" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copiedTab === "cURL" ? "Tersalin" : "Salin"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-between pt-3 border-t border-border/60">
            <Button variant="ghost" size="sm" asChild className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground">
              <Link href={`/dashboard/${tenantSlug}/developer/api`}>
                <BookOpen className="w-3.5 h-3.5 mr-1.5" /> Buka Dokumentasi Lengkap
              </Link>
            </Button>
            <Button onClick={() => onOpenChange(false)} className="h-8 px-4 text-xs font-bold rounded-xl cursor-pointer">
              Selesai
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
