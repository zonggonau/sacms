"use client"

import { useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  BookOpen, Copy, Check, ExternalLink, Package,
  Terminal, Code2, FileCode,
} from "lucide-react"
import { useState, useEffect } from "react"
export default function SdkDocsPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string

  const [copiedBlock, setCopiedBlock] = useState<string | null>(null)
  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading" || status === "unauthenticated") {
    return null
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedBlock(id)
    setTimeout(() => setCopiedBlock(null), 2000)
  }

  const CodeBlock = ({ code, id, lang = "typescript" }: { code: string; id: string; lang?: string }) => (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => handleCopy(code, id)}
      >
        {copiedBlock === id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </Button>
      <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
    </div>
  )

  return (
    <div className="flex bg-background flex-1 flex-col w-full">
<div className="flex-1 min-h-screen flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">SDK & Documentation</h1>
              <p className="text-sm text-muted-foreground">TypeScript SDK, API examples, and integration guides</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <a href="/docs" target="_blank">
                <ExternalLink className="h-3.5 w-3.5" />
                Full API Docs
              </a>
            </Button>
          </div>

          <Tabs defaultValue="sdk">
            <TabsList>
              <TabsTrigger value="sdk" className="gap-1.5">
                <Package className="h-3.5 w-3.5" /> JavaScript SDK
              </TabsTrigger>
              <TabsTrigger value="rest" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> REST API
              </TabsTrigger>
              <TabsTrigger value="types" className="gap-1.5">
                <FileCode className="h-3.5 w-3.5" /> TypeScript Types
              </TabsTrigger>
            </TabsList>

            {/* SDK Tab */}
            <TabsContent value="sdk" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" /> Installation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="install" code={`npm install @sacms/sdk`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quick Start</CardTitle>
                  <CardDescription className="text-xs">Initialize the SDK and fetch content</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CodeBlock id="init" code={`import { SaCMS } from '@sacms/sdk'

const cf = new SaCMS({
  baseUrl: '${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}',
  tenant: '${tenantSlug}',
  token: 'cf_xxxxx',  // Your API token
  locale: 'en',       // Default locale
})`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Find Many (Collection)</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="findMany" code={`const articles = await cf.collection('articles').findMany({
  filters: {
    category: { $eq: 'tutorial' },
    price: { $gte: 100 },
  },
  fields: ['title', 'slug', 'author'],
  populate: ['author', 'tags'],
  locale: 'en',
  sort: 'createdAt:desc',
  pagination: { page: 1, pageSize: 25 },
})`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Find One</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="findOne" code={`const article = await cf.collection('articles').findOne('entry_id', {
  populate: ['author'],
  locale: 'id',
})`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Single Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="single" code={`const homepage = await cf.single('homepage').find({
  locale: 'id',
  populate: ['hero_image', 'featured_articles'],
})`} />
                </CardContent>
              </Card>

            </TabsContent>

            {/* REST Tab */}
            <TabsContent value="rest" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Base URL</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="base" lang="bash" code={`${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/public/${tenantSlug}`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Authentication</CardTitle>
                  <CardDescription className="text-xs">Include your API token in the Authorization header</CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="auth" lang="bash" code={`curl -H "Authorization: Bearer cf_xxxxx" \\
  ${typeof window !== "undefined" ? window.location.origin : "https://your-domain.com"}/api/public/${tenantSlug}/content/articles`} />
                </CardContent>
              </Card>

              {[
                {
                  title: "List Entries", desc: "GET collection entries with filtering",
                  code: `GET /api/public/${tenantSlug}/content/articles\n  ?filters[category][$eq]=tutorial\n  &fields=title,slug,price\n  &populate=author,tags\n  &sort=createdAt:desc\n  &pagination[page]=1&pagination[pageSize]=25`,
                },
                {
                  title: "Get Single Entry", desc: "GET a specific entry by ID",
                  code: `GET /api/public/${tenantSlug}/content/articles/{id}\n  ?populate=author`,
                },
                {
                  title: "Search", desc: "Full-text search across all text fields",
                  code: `GET /api/public/${tenantSlug}/content/articles\n  ?search=next.js+tutorial`,
                },
                {
                  title: "Localization", desc: "Fetch content in a specific locale",
                  code: `GET /api/public/${tenantSlug}/content/articles\n  ?locale=id`,
                },
              ].map((example) => (
                <Card key={example.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{example.title}</CardTitle>
                    <CardDescription className="text-xs">{example.desc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <CodeBlock id={`rest-${example.title}`} lang="http" code={example.code} />
                  </CardContent>
                </Card>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Filter Operators</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      { op: "$eq", desc: "Equal" },
                      { op: "$ne", desc: "Not equal" },
                      { op: "$gt", desc: "Greater than" },
                      { op: "$gte", desc: "Greater or equal" },
                      { op: "$lt", desc: "Less than" },
                      { op: "$lte", desc: "Less or equal" },
                      { op: "$contains", desc: "Contains string" },
                      { op: "$startsWith", desc: "Starts with" },
                      { op: "$endsWith", desc: "Ends with" },
                      { op: "$in", desc: "In array" },
                      { op: "$notIn", desc: "Not in array" },
                      { op: "$null", desc: "Is null" },
                      { op: "$notNull", desc: "Is not null" },
                      { op: "$or", desc: "Logical OR" },
                      { op: "$and", desc: "Logical AND" },
                    ].map((f) => (
                      <div key={f.op} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                        <code className="text-emerald-600 dark:text-emerald-400 font-bold">{f.op}</code>
                        <span className="text-muted-foreground">{f.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>


            {/* TypeScript Types Tab */}
            <TabsContent value="types" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Auto-Generated Types</CardTitle>
                  <CardDescription className="text-xs">
                    Types are generated based on your content type schema. Install the SDK for IntelliSense support.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="types-example" code={`// Auto-generated from your content type schema
interface Article {
  id: string
  title: string
  slug: string
  content: string
  category?: string
  author?: Author
  tags?: Tag[]
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'REJECTED'
  locale: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

interface Author {
  id: string
  name: string
  email: string
  bio?: string
  avatar?: Media
}

// SDK usage with type safety
const articles = await cf.collection<Article>('articles').findMany({
  filters: {
    category: { $eq: 'tutorial' },  // TypeScript validates field names
  },
})

articles.data.forEach(article => {
  console.log(article.title)  // Full IntelliSense
})`} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Response Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <CodeBlock id="response-types" code={`interface SaCMSResponse<T> {
  data: T[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

interface SingleResponse<T> {
  data: T
  meta: {
    availableLocales: string[]
  }
}`} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
