"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Sparkles, Terminal, ArrowRight, X, Maximize2, Plug, Key } from "lucide-react"
import { SchemaStep } from "./schema-step"
import { SchemaDiagram } from "@/components/ai-builder/schema-diagram"

interface SchemaGeneratorClientProps {
  tenantSlug: string
  hasSchema: boolean
  existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  }
}

export function SchemaGeneratorClient({ tenantSlug, hasSchema, existingSchemaSummary }: SchemaGeneratorClientProps) {
  const router = useRouter()
  const [diagramRefreshKey, setDiagramRefreshKey] = useState(0)
  const [showIdeHint, setShowIdeHint] = useState(true)
  const [showFullscreenDiagram, setShowFullscreenDiagram] = useState(false)

  return (
    <div className="flex flex-col h-full min-h-0 gap-4 w-full max-w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 pb-1">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              SaCMS AI Schema Generator
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Beta
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Jelaskan struktur bisnis atau aplikasi Anda, AI merancang Content Type &amp; relasi schema CMS. Kode frontend dibangun di IDE atau AI Agent (ChatGPT, Google Studio, Cursor) terhubung via MCP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => router.push(`/dashboard/${tenantSlug}/developer/mcp`)}
            className="h-8 gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            <Plug className="h-3.5 w-3.5" /> Sambungkan ke AI Agent & IDE (MCP)
            <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* ── "Build in your own IDE" hint banner ── */}
      {showIdeHint && (
        <div className="relative rounded-2xl border border-border/70 bg-muted/30 p-4 text-left shrink-0">
          <button
            type="button"
            onClick={() => setShowIdeHint(false)}
            className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Tutup"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Terminal className="h-4 w-4" />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">Setelah schema siap, integrasikan dengan IDE favorit atau AI Agent pilihan Anda</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Schema CMS tenant ini bisa langsung diakses oleh AI Agent (ChatGPT, Google AI Studio, Claude Desktop, Antigravity) dan IDE (VS Code, Cursor, Windsurf) lewat <strong>Server MCP native</strong> atau <strong>Public REST API</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${tenantSlug}/developer/mcp`)}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Plug className="h-3 w-3" /> Buka Konfigurasi Server MCP <ArrowRight className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${tenantSlug}/developer/api-keys`)}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Key className="h-3 w-3" /> Kunci API & REST
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Schema Wizard ── */}
      <SchemaStep
        tenantSlug={tenantSlug}
        hasSchema={hasSchema}
        existingSchemaSummary={existingSchemaSummary}
        onSchemaReady={() => setDiagramRefreshKey((k) => k + 1)}
      />

      {/* ── ER Diagram ── */}
      <div className="shrink-0 space-y-2 pb-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-foreground">Diagram Schema</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFullscreenDiagram(true)}
            className="h-7 rounded-lg text-[11px] font-bold gap-1.5"
          >
            <Maximize2 className="h-3 w-3" /> Preview Full Screen
          </Button>
        </div>
        <SchemaDiagram tenantSlug={tenantSlug} refreshKey={diagramRefreshKey} />
      </div>

      {/* ── Fullscreen Diagram Preview Modal ── */}
      <Dialog open={showFullscreenDiagram} onOpenChange={setShowFullscreenDiagram}>
        <DialogContent className="max-w-none w-screen h-screen sm:max-w-none top-0 left-0 translate-x-0 translate-y-0 rounded-none p-0 gap-0 flex flex-col">
          <DialogTitle className="sr-only">Diagram Schema — Preview Full Screen</DialogTitle>
          <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
            <h2 className="text-sm font-bold text-foreground">Diagram Schema</h2>
          </div>
          <div className="flex-1 min-h-0 p-4">
            <SchemaDiagram tenantSlug={tenantSlug} refreshKey={diagramRefreshKey} height="100%" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
