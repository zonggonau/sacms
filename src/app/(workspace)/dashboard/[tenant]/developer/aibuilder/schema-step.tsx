"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Sparkles, CheckCircle2, Loader2, ArrowRight, ArrowLeft, Database,
  Layers, FileText, ExternalLink,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FIELD_TYPES } from "@/lib/field-types"
import { QUICK_PROMPT_INSPIRATIONS } from "./website-builder-client"

interface SchemaField {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string
  componentSlug?: string
}

interface SchemaModel {
  name: string
  slug: string
  description?: string
  fields: SchemaField[]
}

interface SchemaPlan {
  domain: string
  title: string
  summary: string
  contentTypes: SchemaModel[]
  singleTypes: SchemaModel[]
  components: SchemaModel[]
  frontendPrompt: string
  estimatedCredits: number
}

interface SchemaStepProps {
  tenantSlug: string
  hasSchema: boolean
  existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  }
  onSchemaReady: (frontendPromptSeed?: string) => void
}

function FieldBadge({ field }: { field: SchemaField }) {
  const meta = FIELD_TYPES.find((f) => f.type === field.type)
  const Icon = meta?.icon || Database
  return (
    <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-muted/40 border-border/70">
      <Icon className="h-3 w-3 text-muted-foreground" />
      {field.name}
      {field.required && <span className="text-primary">*</span>}
    </Badge>
  )
}

function SchemaModelCard({ model, typeLabel }: { model: SchemaModel; typeLabel: string }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">{model.name}</CardTitle>
          <Badge variant="outline" className="text-[10px] font-bold shrink-0">{typeLabel}</Badge>
        </div>
        {model.description && (
          <CardDescription className="text-xs">{model.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          {(model.fields || []).map((f) => (
            <FieldBadge key={f.slug || f.name} field={f} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SchemaStep({ tenantSlug, hasSchema, existingSchemaSummary, onSchemaReady }: SchemaStepProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState<"summary" | "compose" | "review">(hasSchema ? "summary" : "compose")
  const [prompt, setPrompt] = useState("")
  const [isPlanning, setIsPlanning] = useState(false)
  const [plan, setPlan] = useState<SchemaPlan | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handlePlanSchema = async () => {
    if (!prompt.trim()) return
    setIsPlanning(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/plan-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal merencanakan skema")
      setPlan(data.plan)
      setStep("review")
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Membuat Skema", description: err.message })
    } finally {
      setIsPlanning(false)
    }
  }

  const handleConfirmSchema = async () => {
    if (!plan) return
    setIsImporting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/import-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: {
            contentTypes: plan.contentTypes,
            singleTypes: plan.singleTypes,
            components: plan.components,
          },
          frontendPrompt: plan.frontendPrompt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan skema")
      toast({ title: "Skema Disimpan", description: `${data.imported} struktur berhasil dibuat.` })
      onSchemaReady(plan.frontendPrompt)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan Skema", description: err.message })
    } finally {
      setIsImporting(false)
    }
  }

  if (step === "summary") {
    const totalModels = existingSchemaSummary.contentTypes.length + existingSchemaSummary.singleTypes.length
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-[520px] py-10">
        <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">
              Schema CMS Anda Sudah Siap
            </h2>
            <p className="text-xs text-muted-foreground">
              {totalModels} struktur data ditemukan. Tinjau sebentar, atau lanjut langsung ke pembuatan frontend.
            </p>
          </div>

          <div className="rounded-2xl bg-card border border-border/80 shadow-md divide-y divide-border/60 max-h-[320px] overflow-y-auto">
            {existingSchemaSummary.contentTypes.map((ct) => (
              <div key={ct.slug} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Layers className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{ct.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">Content Type</Badge>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold shrink-0">{ct.fieldCount} Fields</Badge>
              </div>
            ))}
            {existingSchemaSummary.singleTypes.map((st) => (
              <div key={st.slug} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{st.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">Single Type</Badge>
                </div>
                <Badge variant="outline" className="text-[10px] font-bold shrink-0">{st.fieldCount} Fields</Badge>
              </div>
            ))}
            {totalModels === 0 && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                Tidak ada detail struktur yang bisa ditampilkan.
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Button
              onClick={() => onSchemaReady()}
              className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
            >
              Lanjutkan ke Generate Frontend
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/dashboard/${tenantSlug}/developer/conten-type`)}
              className="h-10 px-6 rounded-full font-bold text-xs w-full sm:w-auto"
            >
              Kelola Schema
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setStep("compose")}
              className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Buat Ulang / Tambah Schema dengan AI
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "review" && plan) {
    const allModels: Array<{ model: SchemaModel; typeLabel: string }> = [
      ...plan.contentTypes.map((m) => ({ model: m, typeLabel: "Content Type" })),
      ...plan.singleTypes.map((m) => ({ model: m, typeLabel: "Single Type" })),
      ...plan.components.map((m) => ({ model: m, typeLabel: "Komponen" })),
    ]
    return (
      <div className="flex flex-1 flex-col min-h-[520px] py-10">
        <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
          <div className="text-center space-y-1.5">
            <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{plan.title}</h2>
            <p className="text-xs text-muted-foreground">{plan.summary}</p>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {allModels.map(({ model, typeLabel }) => (
              <SchemaModelCard key={model.slug || model.name} model={model} typeLabel={typeLabel} />
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Button
              variant="outline"
              onClick={() => setStep("compose")}
              disabled={isImporting}
              className="h-10 px-6 rounded-full font-bold text-xs w-full sm:w-auto"
            >
              Ubah Prompt
            </Button>
            <Button
              onClick={handleConfirmSchema}
              disabled={isImporting}
              className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isImporting ? "Menyimpan Skema..." : "Konfirmasi & Simpan Schema"}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // step === "compose"
  return (
    <div className="flex flex-1 flex-col items-center justify-center min-h-[520px] py-10">
      <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
        {hasSchema && (
          <button
            type="button"
            onClick={() => setStep("summary")}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" /> Kembali
          </button>
        )}

        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center">
          Jelaskan jenis website/bisnis Anda
        </h2>
        <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
          AI akan merancang struktur data (content types &amp; fields) untuk website Anda. Anda bisa meninjau
          dan mengubahnya sebelum disimpan.
        </p>

        <div className="rounded-2xl bg-card border border-border/80 shadow-md overflow-visible">
          <Textarea
            placeholder="Contoh: Website resor & pariwisata dengan katalog kamar, paket wisata, dan galeri..."
            className="resize-none min-h-[96px] text-sm rounded-2xl border-0 shadow-none bg-transparent p-4 focus-visible:ring-0"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handlePlanSchema()
              }
            }}
          />
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={handlePlanSchema}
            disabled={isPlanning || !prompt.trim()}
            className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
          >
            {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isPlanning ? "Merencanakan Skema..." : "Buat Schema dengan AI (-5 Credits)"}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Otomatis memakai template gratis jika saldo AI Credit tidak cukup.
          </p>
        </div>

        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Ide Cepat
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {QUICK_PROMPT_INSPIRATIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(item.prompt)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/60 transition-all text-muted-foreground cursor-pointer"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/${tenantSlug}/developer/conten-type/new`)}
            className="text-[11px] font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
          >
            atau buat manual <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
