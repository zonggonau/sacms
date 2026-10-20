"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Sparkles, Maximize2, Plug, Layers, FileText, Box, Database, Loader2, X } from "lucide-react"
import { SchemaStep } from "./schema-step"
import { SchemaDiagram, type SchemaExport } from "@/components/ai-builder/schema-diagram"
import { SchemaModelGrid } from "@/components/ai-builder/schema-model-grid"

interface SchemaGeneratorClientProps {
  tenantSlug: string
  hasSchema: boolean
  existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  }
}

const EMPTY_SCHEMA: SchemaExport = { contentTypes: [], singleTypes: [], components: [] }

export function SchemaGeneratorClient({ tenantSlug, hasSchema, existingSchemaSummary }: SchemaGeneratorClientProps) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)
  const [showGenerator, setShowGenerator] = useState(false)
  const [showFullscreenDiagram, setShowFullscreenDiagram] = useState(false)
  const [schema, setSchema] = useState<SchemaExport>(EMPTY_SCHEMA)
  const [isLoadingSchema, setIsLoadingSchema] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoadingSchema(true)
    fetch(`/api/tenant/${tenantSlug}/ai-builder/export-schema`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Gagal memuat skema"))))
      .then((data: SchemaExport) => {
        if (!cancelled) setSchema(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingSchema(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantSlug, refreshKey])

  const onSchemaReady = () => {
    setRefreshKey((k) => k + 1)
    setShowGenerator(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── App-shell header ── */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Database className="size-4 shrink-0 text-primary" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">
          SaCMS AI Schema Generator
          <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full align-middle">
            Beta
          </Badge>
        </h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => router.push(`/dashboard/${tenantSlug}/developer/mcp`)}
          className="h-8 gap-1.5 text-xs font-bold"
        >
          <Plug className="size-3.5" /> Sambungkan ke MCP
        </Button>
        <Button
          size="sm"
          onClick={() => setShowGenerator(true)}
          className="h-8 gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          <Sparkles className="size-3.5" /> AI Schema Generator
        </Button>
      </header>

      {/* ── Full-width tabbed workspace ── */}
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-5">
        <Tabs defaultValue="diagram" className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="diagram" className="gap-1.5">
                <Database className="h-3.5 w-3.5" /> Diagram Schema
              </TabsTrigger>
              <TabsTrigger value="content-types" className="gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Content Type
                <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 ml-0.5">{schema.contentTypes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="single-types" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Single Type
                <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 ml-0.5">{schema.singleTypes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="components" className="gap-1.5">
                <Box className="h-3.5 w-3.5" /> Component
                <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 ml-0.5">{schema.components.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="diagram" className="flex min-h-0 flex-col gap-2 data-[state=inactive]:hidden">
            <div className="flex items-center justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFullscreenDiagram(true)}
                className="h-7 rounded-lg text-[11px] font-bold gap-1.5"
              >
                <Maximize2 className="h-3 w-3" /> Full Screen
              </Button>
            </div>
            <div className="flex-1 min-h-[480px] rounded-2xl border border-border/80 bg-muted/10 overflow-hidden">
              <SchemaDiagram data={schema} height="100%" />
            </div>
          </TabsContent>

          <TabsContent value="content-types" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
            {isLoadingSchema ? (
              <LoadingState />
            ) : (
              <SchemaModelGrid
                models={schema.contentTypes}
                typeLabel="Content Type"
                emptyMessage="Belum ada Content Type — buat lewat AI Schema Generator atau manual."
              />
            )}
          </TabsContent>

          <TabsContent value="single-types" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
            {isLoadingSchema ? (
              <LoadingState />
            ) : (
              <SchemaModelGrid
                models={schema.singleTypes}
                typeLabel="Single Type"
                emptyMessage="Belum ada Single Type — buat lewat AI Schema Generator atau manual."
              />
            )}
          </TabsContent>

          <TabsContent value="components" className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden">
            {isLoadingSchema ? (
              <LoadingState />
            ) : (
              <SchemaModelGrid
                models={schema.components}
                typeLabel="Komponen"
                emptyMessage="Belum ada Komponen reusable."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── AI Schema Generator — half-screen side panel, not a full overlay, so the Diagram Schema tab stays visible on the other half ── */}
      <DialogPrimitive.Root open={showGenerator} onOpenChange={setShowGenerator}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-transparent" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-1/2"
          >
            <DialogPrimitive.Title className="sr-only">AI Schema Generator</DialogPrimitive.Title>
            <div className="flex items-center gap-2.5 border-b border-border/70 bg-gradient-to-r from-violet-500/10 via-primary/5 to-transparent px-5 py-4 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground leading-tight">AI Schema Generator</p>
                <p className="text-[11px] text-muted-foreground truncate">Jelaskan bisnis Anda atau upload dokumen referensi — AI merancang struktur CMS lengkap</p>
              </div>
              <DialogPrimitive.Close
                aria-label="Tutup"
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-70 transition-all hover:opacity-100 hover:bg-muted focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:outline-hidden cursor-pointer"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SchemaStep
                tenantSlug={tenantSlug}
                hasSchema={hasSchema}
                existingSchemaSummary={existingSchemaSummary}
                onSchemaReady={onSchemaReady}
              />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ── Fullscreen Diagram Preview Modal ── */}
      <Dialog open={showFullscreenDiagram} onOpenChange={setShowFullscreenDiagram}>
        <DialogContent className="max-w-none w-screen h-screen sm:max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none p-0 gap-0 flex flex-col">
          <DialogTitle className="sr-only">Diagram Schema — Preview Full Screen</DialogTitle>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
            <h2 className="text-sm font-bold text-foreground">Diagram Schema</h2>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <SchemaDiagram data={schema} height="100%" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Memuat skema...
    </div>
  )
}
