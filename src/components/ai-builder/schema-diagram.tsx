"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import dagre from "@dagrejs/dagre"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, Layers, FileText, Box } from "lucide-react"
import { FIELD_TYPES } from "@/lib/field-types"

export interface SchemaField {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string | null
  componentSlug?: string | null
}

export interface SchemaModel {
  name: string
  slug: string
  description?: string | null
  fields: SchemaField[]
}

export interface SchemaExport {
  contentTypes: SchemaModel[]
  singleTypes: SchemaModel[]
  components: SchemaModel[]
}

interface TableNodeData {
  label: string
  kind: "Content Type" | "Single Type" | "Komponen"
  fields: SchemaField[]
  [key: string]: unknown
}

const NODE_WIDTH = 260

function estimateNodeHeight(fieldCount: number) {
  return 64 + Math.max(1, fieldCount) * 24
}

function kindIcon(kind: TableNodeData["kind"]) {
  if (kind === "Content Type") return Layers
  if (kind === "Single Type") return FileText
  return Box
}

function TableNode({ data }: { data: TableNodeData }) {
  const KindIcon = kindIcon(data.kind)
  return (
    <div
      className="rounded-2xl border border-border/80 bg-card shadow-md overflow-hidden"
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" />
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <KindIcon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-bold text-foreground truncate">{data.label}</span>
        </div>
        <Badge variant="outline" className="text-[9px] font-bold shrink-0">{data.kind}</Badge>
      </div>
      <div className="p-2 space-y-1 max-h-[280px] overflow-y-auto">
        {data.fields.length === 0 ? (
          <p className="text-[10px] text-muted-foreground px-1 py-1">Tidak ada field</p>
        ) : (
          data.fields.map((f) => {
            const meta = FIELD_TYPES.find((ft) => ft.type === f.type)
            const Icon = meta?.icon || Database
            const isLink = f.type === "relation" || f.type === "component" || f.type === "repeater"
            return (
              <div
                key={f.slug || f.name}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[10px] ${
                  isLink ? "bg-primary/5" : "bg-muted/30"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 text-foreground">
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{f.name}</span>
                  {f.required && <span className="text-primary">*</span>}
                </span>
                <span className="text-[9px] text-muted-foreground font-mono shrink-0">{f.type}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

const nodeTypes = { table: TableNode }

function buildGraph(schema: SchemaExport): { nodes: Node<TableNodeData>[]; edges: Edge[] } {
  const contentTypeSlugs = new Set(schema.contentTypes.map((m) => m.slug))

  const rawNodes: Array<{ id: string; data: TableNodeData }> = [
    ...schema.contentTypes.map((m) => ({ id: `ct:${m.slug}`, data: { label: m.name, kind: "Content Type" as const, fields: m.fields || [] } })),
    ...schema.singleTypes.map((m) => ({ id: `st:${m.slug}`, data: { label: m.name, kind: "Single Type" as const, fields: m.fields || [] } })),
    ...schema.components.map((m) => ({ id: `comp:${m.slug}`, data: { label: m.name, kind: "Komponen" as const, fields: m.fields || [] } })),
  ]

  const rawEdges: Edge[] = []
  const allModels = [
    ...schema.contentTypes.map((m) => ({ ...m, sourceId: `ct:${m.slug}` })),
    ...schema.singleTypes.map((m) => ({ ...m, sourceId: `st:${m.slug}` })),
  ]

  for (const model of allModels) {
    for (const field of model.fields || []) {
      if (field.type === "relation" && field.relationSlug) {
        const targetId = contentTypeSlugs.has(field.relationSlug) ? `ct:${field.relationSlug}` : `st:${field.relationSlug}`
        if (rawNodes.some((n) => n.id === targetId)) {
          rawEdges.push({
            id: `${model.sourceId}->${targetId}:${field.slug}`,
            source: model.sourceId,
            target: targetId,
            label: field.name,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
            style: { stroke: "var(--color-primary)" },
            labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
          })
        }
      } else if ((field.type === "component" || field.type === "repeater") && field.componentSlug) {
        const targetId = `comp:${field.componentSlug}`
        if (rawNodes.some((n) => n.id === targetId)) {
          rawEdges.push({
            id: `${model.sourceId}->${targetId}:${field.slug}`,
            source: model.sourceId,
            target: targetId,
            label: field.name,
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            style: { stroke: "var(--color-muted-foreground)", strokeDasharray: "4 3" },
            labelStyle: { fontSize: 10, fill: "var(--color-muted-foreground)" },
          })
        }
      }
    }
  }

  // Auto-layout with dagre — react-flow has no built-in layout engine.
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 90 })

  for (const n of rawNodes) {
    graph.setNode(n.id, { width: NODE_WIDTH, height: estimateNodeHeight(n.data.fields.length) })
  }
  for (const e of rawEdges) {
    graph.setEdge(e.source, e.target)
  }
  dagre.layout(graph)

  const nodes: Node<TableNodeData>[] = rawNodes.map((n) => {
    const pos = graph.node(n.id)
    const height = estimateNodeHeight(n.data.fields.length)
    return {
      id: n.id,
      type: "table",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - height / 2 },
      data: n.data,
    }
  })

  return { nodes, edges: rawEdges }
}

interface SchemaDiagramProps {
  /** Omit when `data` is given directly — only needed for the self-fetching mode. */
  tenantSlug?: string
  /** Bump this to force a re-fetch (e.g. after a schema is imported). Ignored when `data` is given. */
  refreshKey?: number
  /** Container height (any CSS value). Defaults to a fixed inline preview size. */
  height?: string
  /**
   * Pre-fetched schema to render instead of fetching the tenant's whole
   * live schema — e.g. a Schema Template's own `{contentTypes, singleTypes,
   * components}` blob, which has nothing to do with "the current tenant's
   * schema" and would be wrong to dump via /ai-builder/export-schema.
   */
  data?: SchemaExport
}

function SchemaDiagramInner({ tenantSlug, refreshKey, data }: SchemaDiagramProps) {
  const [schema, setSchema] = useState<SchemaExport | null>(data ?? null)
  const [isLoading, setIsLoading] = useState(!data)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TableNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  useEffect(() => {
    if (data) {
      setSchema(data)
      setIsLoading(false)
      setError(null)
      return
    }
    if (!tenantSlug) return

    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`/api/tenant/${tenantSlug}/ai-builder/export-schema`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Gagal memuat skema"))))
      .then((fetched: SchemaExport) => {
        if (cancelled) return
        setSchema(fetched)
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || "Gagal memuat skema")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantSlug, refreshKey, data])

  const graph = useMemo(() => (schema ? buildGraph(schema) : null), [schema])

  useEffect(() => {
    if (!graph) return
    setNodes(graph.nodes)
    setEdges(graph.edges)
  }, [graph, setNodes, setEdges])

  const totalModels = schema ? schema.contentTypes.length + schema.singleTypes.length + schema.components.length : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat diagram skema...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-destructive">
        {error}
      </div>
    )
  }

  if (totalModels === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-1.5 text-muted-foreground">
        <Database className="h-6 w-6 opacity-50" />
        <p className="text-xs">Belum ada struktur data untuk digambar.</p>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.1}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable className="!bg-card" />
    </ReactFlow>
  )
}

export function SchemaDiagram({ height = "480px", ...props }: SchemaDiagramProps) {
  return (
    <div className="w-full rounded-2xl border border-border/80 bg-muted/10 overflow-hidden" style={{ height }}>
      <ReactFlowProvider>
        <SchemaDiagramInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
