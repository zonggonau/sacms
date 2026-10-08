"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Sparkles, CheckCircle2, Loader2, ArrowLeft, Database, ExternalLink, Cpu, LayoutTemplate,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FIELD_TYPES } from "@/lib/field-types"

// Curated shortlist from the Vercel AI Gateway catalog — one subscription
// covers all of these, this is just a reasonable spread of providers/price
// points rather than dumping the full multi-hundred-model catalog on the user.
export const SCHEMA_MODEL_OPTIONS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", hint: "Cepat & hemat — default" },
  { value: "google/gemini-3-flash", label: "Gemini 3 Flash", hint: "Lebih baru, lebih pintar" },
  { value: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", hint: "Seimbang, kualitas tinggi" },
  { value: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5", hint: "Paling cepat dari Claude" },
  { value: "openai/gpt-5.4", label: "GPT-5.4", hint: "Flagship OpenAI" },
  { value: "openai/gpt-4.1-mini", label: "GPT-4.1 Mini", hint: "Hemat" },
  { value: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", hint: "Hemat, kuat untuk struktur data" },
  { value: "zai/glm-4.6", label: "GLM-4.6", hint: "Alternatif hemat" },
] as const

export const QUICK_PROMPT_INSPIRATIONS = [
  {
    icon: "🏖️",
    label: "Resor & Pariwisata",
    prompt: "Buat skema untuk Grand Resort & Pariwisata dengan katalog tipe kamar (Deluxe, Ocean Villa), paket wisata bahari/diving, fasilitas resto seafood, galeri foto, dan formulir booking reservasi online.",
  },
  {
    icon: "☕",
    label: "Toko Online UMKM",
    prompt: "Buat skema untuk toko online e-commerce UMKM produk kopi dan kerajinan tangan, dengan katalog produk filterable, varian berat/ukuran, harga diskon, ulasan bintang, dan checkout WhatsApp instan.",
  },
  {
    icon: "📰",
    label: "Portal Berita & Media",
    prompt: "Buat skema untuk portal media berita digital dengan kategori topik (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks, headline breaking news, profil jurnalis, dan feed pengumuman publik.",
  },
  {
    icon: "🏥",
    label: "Klinik & Jadwal Dokter",
    prompt: "Buat skema untuk profil klinik kesehatan dengan jadwal praktik dokter spesialis, direktori layanan medis & poliklinik, artikel kesehatan, dan formulir pendaftaran janji temu pasien.",
  },
  {
    icon: "🎓",
    label: "Sekolah & PPDB Online",
    prompt: "Buat skema untuk institusi sekolah/kejuruan dengan profil sekolah, direktori jurusan/program keahlian, pengumuman akademik, galeri prestasi siswa, dan formulir pendaftaran PPDB online.",
  },
  {
    icon: "💼",
    label: "Agensi & Portofolio",
    prompt: "Buat skema untuk portofolio agensi digital kreatif dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, paket pricing harga, dan formulir konsultasi proyek.",
  },
]

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
}

interface SchemaTemplateItem {
  id: string
  name: string
  slug: string
  category: string
  icon: string
  description: string | null
  published: boolean
  schema: {
    contentTypes: SchemaModel[]
    singleTypes: SchemaModel[]
    components: SchemaModel[]
  }
}

interface SchemaStepProps {
  tenantSlug: string
  hasSchema: boolean
  existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  }
  /** Fires after a schema is successfully imported/saved, so the parent can refresh (ER diagram or template list). */
  onSchemaReady: () => void
  /**
   * "import" (default): the usual tenant flow — AI plans a schema, confirming
   * imports it as real Content Types/Single Types/Components.
   * "template": SaCMS Global-only authoring — confirming saves the plan as a
   * reusable SchemaTemplate catalog entry (draft, unpublished) instead.
   */
  mode?: "import" | "template"
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

export function SchemaStep({ tenantSlug, hasSchema, existingSchemaSummary, onSchemaReady, mode = "import" }: SchemaStepProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isTemplateMode = mode === "template"

  const [step, setStep] = useState<"compose" | "review">("compose")
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string>(SCHEMA_MODEL_OPTIONS[0].value)
  const [isPlanning, setIsPlanning] = useState(false)
  const [plan, setPlan] = useState<SchemaPlan | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Only used in "template" mode — metadata for the SchemaTemplate row.
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("")
  const [templateIcon, setTemplateIcon] = useState("📦")
  const [templateDescription, setTemplateDescription] = useState("")

  // Template gallery — only relevant for regular tenants picking a
  // published template to import, not for Global's own authoring mode.
  const [templates, setTemplates] = useState<SchemaTemplateItem[]>([])
  useEffect(() => {
    if (isTemplateMode) return
    fetch(`/api/tenant/${tenantSlug}/schema-templates`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.templates) setTemplates(data.templates.filter((t: SchemaTemplateItem) => t.published))
      })
      .catch(() => {})
  }, [tenantSlug, isTemplateMode])

  const handlePickTemplate = (template: SchemaTemplateItem) => {
    setPlan({
      domain: template.category,
      title: template.name,
      summary: template.description || `Template "${template.name}" — tinjau sebelum disimpan.`,
      contentTypes: template.schema.contentTypes || [],
      singleTypes: template.schema.singleTypes || [],
      components: template.schema.components || [],
    })
    setStep("review")
  }

  const handlePlanSchema = async () => {
    if (!prompt.trim()) return
    setIsPlanning(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/plan-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model }),
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

    if (isTemplateMode) {
      if (!templateName.trim() || !templateCategory.trim()) {
        toast({ variant: "destructive", title: "Lengkapi Detail Template", description: "Nama dan kategori template wajib diisi." })
        return
      }
      setIsImporting(true)
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim(),
            category: templateCategory.trim(),
            icon: templateIcon.trim() || undefined,
            description: templateDescription.trim() || undefined,
            schema: {
              contentTypes: plan.contentTypes,
              singleTypes: plan.singleTypes,
              components: plan.components,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Gagal menyimpan template")
        toast({ title: "Template Tersimpan", description: `"${templateName}" disimpan sebagai draft — publish dari daftar template agar terlihat tenant lain.` })
        setPlan(null)
        setPrompt("")
        setTemplateName("")
        setTemplateCategory("")
        setTemplateIcon("📦")
        setTemplateDescription("")
        setStep("compose")
        onSchemaReady()
      } catch (err: any) {
        toast({ variant: "destructive", title: "Gagal Menyimpan Template", description: err.message })
      } finally {
        setIsImporting(false)
      }
      return
    }

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
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan skema")
      toast({ title: "Schema Tersimpan", description: `${data.imported} struktur berhasil dibuat. Lihat diagram di bawah.` })
      setPlan(null)
      setPrompt("")
      setStep("compose")
      onSchemaReady()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan Skema", description: err.message })
    } finally {
      setIsImporting(false)
    }
  }

  if (step === "review" && plan) {
    const allModels: Array<{ model: SchemaModel; typeLabel: string }> = [
      ...plan.contentTypes.map((m) => ({ model: m, typeLabel: "Content Type" })),
      ...plan.singleTypes.map((m) => ({ model: m, typeLabel: "Single Type" })),
      ...plan.components.map((m) => ({ model: m, typeLabel: "Komponen" })),
    ]
    return (
      <div className="flex flex-1 flex-col py-10">
        <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
          <button
            type="button"
            onClick={() => setStep("compose")}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" /> Ubah Prompt
          </button>

          <div className="text-center space-y-1.5">
            <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{plan.title}</h2>
            <p className="text-xs text-muted-foreground">{plan.summary}</p>
          </div>

          {isTemplateMode && (
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Detail Template</CardTitle>
                <CardDescription className="text-xs">Diisi sebelum disimpan sebagai draft — bisa diubah lagi nanti dari daftar template.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Template</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="mis. Website Desa"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
                    <Input
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value)}
                      placeholder="mis. Pemerintahan"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ikon</Label>
                    <Input
                      value={templateIcon}
                      onChange={(e) => setTemplateIcon(e.target.value)}
                      className="h-9 w-16 text-center text-sm rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deskripsi (opsional)</Label>
                  <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Ringkasan singkat untuk tenant yang menjelajahi galeri template"
                    className="resize-none min-h-[60px] text-xs rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {allModels.map(({ model, typeLabel }) => (
              <SchemaModelCard key={model.slug || model.name} model={model} typeLabel={typeLabel} />
            ))}
          </div>

          <div className="flex items-center justify-center pt-1">
            <Button
              onClick={handleConfirmSchema}
              disabled={isImporting}
              className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isImporting
                ? (isTemplateMode ? "Menyimpan Template..." : "Menyimpan Skema...")
                : (isTemplateMode ? "Simpan sebagai Template" : "Konfirmasi & Simpan Schema")}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // step === "compose"
  const totalExisting = existingSchemaSummary.contentTypes.length + existingSchemaSummary.singleTypes.length
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
        {!isTemplateMode && hasSchema && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Schema Anda sudah punya {totalExisting} struktur data — lihat diagram-nya di bawah, atau tambah lagi lewat prompt di sini.
          </div>
        )}

        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center">
          {isTemplateMode ? "Jelaskan jenis template yang ingin dibuat" : "Jelaskan jenis website/bisnis Anda"}
        </h2>
        <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
          {isTemplateMode
            ? "AI akan merancang struktur data untuk template ini. Anda bisa meninjau dan mengubahnya sebelum disimpan sebagai draft."
            : "AI akan merancang struktur data (content types & fields) untuk website Anda. Anda bisa meninjau dan mengubahnya sebelum disimpan."}
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
          <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 border-t border-border/50">
            <Cpu className="h-3 w-3 text-muted-foreground shrink-0" />
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none hover:bg-muted/50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-card">
                {SCHEMA_MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg">
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-muted-foreground ml-1.5">— {opt.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={handlePlanSchema}
            disabled={isPlanning || !prompt.trim()}
            className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
          >
            {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isPlanning ? "Merencanakan Skema..." : isTemplateMode ? "Rencanakan Template dengan AI" : "Buat Schema dengan AI (-5 Credits)"}
          </Button>
          {!isTemplateMode && (
            <p className="text-[10px] text-muted-foreground">
              Otomatis memakai template gratis jika saldo AI Credit tidak cukup.
            </p>
          )}
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

        {!isTemplateMode && templates.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1">
              <LayoutTemplate className="h-3 w-3 text-primary" /> Galeri Template
            </span>
            <p className="text-[10px] text-muted-foreground text-center">
              Dibuat tim SaCMS — pakai langsung, lalu sesuaikan sendiri.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePickTemplate(t)}
                  title={t.description || t.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-primary/5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-primary/20 transition-all text-foreground cursor-pointer"
                >
                  <span>{t.icon}</span>
                  <span>{t.name}</span>
                  <Badge variant="outline" className="text-[9px] font-bold px-1 py-0 ml-0.5 border-primary/20 text-primary">{t.category}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {!isTemplateMode && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${tenantSlug}/content-type-builder/content-types/new`)}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              atau buat manual <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
