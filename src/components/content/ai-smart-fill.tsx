"use client"

import { useState } from "react"
import { 
  Sparkles, Loader2, Wand2, Check, Info, 
  Lightbulb, RotateCcw, CheckCircle2, Languages, Sliders,
  Layers, ArrowRight, X, FileText, Bot
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AISmartFillProps {
  tenantSlug: string
  contentTypeName: string
  schema: any[]
  onApply: (data: Record<string, any>) => void
}

const QUICK_PROMPTS = [
  {
    icon: "🚀",
    title: "Peluncuran Fitur",
    prompt: "Tulis pengumuman rilis fitur baru platform dengan penjelasan keunggulan utama, cara kerja, dan manfaat nyata bagi pengguna.",
  },
  {
    icon: "📚",
    title: "Panduan Tutorial",
    prompt: "Buat panduan langkah demi langkah yang jelas dan praktis tentang cara implementasi teknologi modern dengan studi kasus konkret.",
  },
  {
    icon: "💡",
    title: "Artikel Edukatif",
    prompt: "Tulis artikel mendalam mengenai tren industri teknologi terkini, analisis tantangan, serta solusi strategis yang dapat diterapkan.",
  },
  {
    icon: "⭐",
    title: "Studi Kasus Klien",
    prompt: "Tulis ringkasan studi kasus keberhasilan klien: latar belakang masalah, solusi yang diimplementasikan, dan metrik hasil terukur.",
  },
]

export function AISmartFill({
  tenantSlug,
  contentTypeName,
  schema,
  onApply,
}: AISmartFillProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [tone, setTone] = useState<string>("Professional")
  const [language, setLanguage] = useState<string>("Indonesian")
  const [generatedData, setGeneratedData] = useState<Record<string, any> | null>(null)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setGeneratedData(null)
    try {
      const aiSchema = schema.map((f) => ({
        slug: f.slug,
        name: f.name,
        type: f.type,
        required: f.required,
      }))

      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/smart-fill` : `/api/tenant/${tenantSlug}/ai/smart-fill`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType: contentTypeName,
          schema: aiSchema,
          tone,
          language,
        }),
      })

      const data = await res.json()
      if (res.ok && data.content) {
        setGeneratedData(data.content)
      } else {
        throw new Error(data.error || "Gagal memproses AI Smart Fill")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error AI Smart Fill", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmApply = () => {
    if (!generatedData) return
    onApply(generatedData)
    setOpen(false)
    setPrompt("")
    setGeneratedData(null)
    toast({
      title: "✨ Formulir Berhasil Terisi!",
      description: `Seluruh field model ${contentTypeName} telah diisi otomatis oleh AI.`,
    })
  }

  const handleApplyDirectly = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    try {
      const aiSchema = schema.map((f) => ({
        slug: f.slug,
        name: f.name,
        type: f.type,
        required: f.required,
      }))

      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/smart-fill` : `/api/tenant/${tenantSlug}/ai/smart-fill`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType: contentTypeName,
          schema: aiSchema,
          tone,
          language,
        }),
      })

      const data = await res.json()
      if (res.ok && data.content) {
        onApply(data.content)
        setOpen(false)
        setPrompt("")
        setGeneratedData(null)
        toast({
          title: "✨ Formulir Berhasil Terisi!",
          description: `Seluruh field model ${contentTypeName} telah diisi otomatis oleh AI.`,
        })
      } else {
        throw new Error(data.error || "Gagal memproses AI Smart Fill")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error AI Smart Fill", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="h-9 px-3.5 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 transition-all shadow-xs gap-1.5 cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/40" />
          AI Smart Fill
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[680px] rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl p-0 overflow-hidden">
        {/* Header with SaCMS Gradient Banner Style */}
        <DialogHeader className="p-5 pb-4 border-b border-border/70 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent pr-12 text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-bold text-foreground">
                  AI Smart Fill
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 rounded-full px-2.5 py-0.5">
                  <Sparkles className="w-2.5 h-2.5 mr-1 text-emerald-500" />
                  Model: {contentTypeName}
                </Badge>
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold rounded-md">
                  {schema.length} Fields
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                Tulis ide atau draf kasar. AI akan menganalisis skema model dan otomatis memetakan seluruh field formulir.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
          
          {/* Quick Prompts Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              <span>Inspirasi Template Cepat:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(qp.prompt)}
                  className="flex flex-col items-start p-2.5 rounded-xl bg-muted/30 hover:bg-emerald-500/10 hover:border-emerald-500/40 border border-border/70 transition-all cursor-pointer text-left group"
                >
                  <span className="text-base mb-1">{qp.icon}</span>
                  <span className="text-xs font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                    {qp.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                    {qp.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" /> Ide Konten / Draf / Instruksi
              </Label>
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt("")}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                >
                  Bersihkan
                </button>
              )}
            </div>
            <Textarea
              placeholder="Contoh: Buat artikel komprehensif tentang arsitektur SaaS Headless CMS berbasis Next.js 16. Sertakan judul menarik, slug SEO friendly, ringkasan manfaat, dan draf isi artikel yang mendalam..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] rounded-xl border-border/80 bg-background text-foreground focus-visible:ring-emerald-500 p-3.5 text-xs leading-relaxed"
            />
          </div>

          {/* Settings Grid (Language & Tone) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/20 border border-border/70 rounded-xl">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-primary" /> Bahasa Output
              </Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="rounded-xl font-medium h-9 bg-background border-border/80 text-xs">
                  <SelectValue placeholder="Pilih Bahasa" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="Indonesian" className="text-xs">Bahasa Indonesia</SelectItem>
                  <SelectItem value="English" className="text-xs">English (US)</SelectItem>
                  <SelectItem value="Japanese" className="text-xs">日本語 (Japanese)</SelectItem>
                  <SelectItem value="Spanish" className="text-xs">Español (Spanish)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" /> Gaya Bahasa (Tone)
              </Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="rounded-xl font-medium h-9 bg-background border-border/80 text-xs">
                  <SelectValue placeholder="Pilih Gaya" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="Professional" className="text-xs">Profesional & Berbobot</SelectItem>
                  <SelectItem value="Casual" className="text-xs">Santai & Komunikatif</SelectItem>
                  <SelectItem value="Journalistic" className="text-xs">Jurnalistik & Faktual</SelectItem>
                  <SelectItem value="Creative" className="text-xs">Kreatif & Persuasif</SelectItem>
                  <SelectItem value="Technical" className="text-xs">Teknis & Terstruktur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Generated Data Preview Box */}
          {generatedData && (
            <div className="space-y-2 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Pratinjau Hasil AI ({Object.keys(generatedData).length} field siap diterapkan):
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="h-6 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 rounded-md cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Buat Ulang
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs bg-background/90 p-3 rounded-lg border border-emerald-500/20 font-mono">
                {Object.entries(generatedData).map(([key, val]) => (
                  <div key={key} className="flex items-start gap-2 py-0.5 border-b border-border/30 last:border-0">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">{key}:</span>
                    <span className="text-foreground truncate leading-relaxed">
                      {typeof val === "object" ? JSON.stringify(val) : String(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Helper Tips */}
          <div className="flex gap-2.5 p-3 bg-muted/20 rounded-xl border border-border/70 text-muted-foreground text-xs leading-relaxed">
            <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
            <p>
              AI akan mengisi field teks, rich text, slug, SEO, tags, rating, dan metadata sesuai skema. Anda dapat meninjau dan mengedit kembali seluruh field setelah data diterapkan ke formulir.
            </p>
          </div>

        </div>

        {/* Footer */}
        <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false)
              setGeneratedData(null)
            }}
            disabled={loading}
            className="rounded-xl border-border/80 h-9 text-xs font-semibold cursor-pointer"
          >
            Batal
          </Button>

          {generatedData ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-9 px-5 text-xs shadow-xs cursor-pointer gap-1.5"
              onClick={handleConfirmApply}
            >
              <Check className="h-3.5 w-3.5" />
              Terapkan ke Formulir
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="font-bold rounded-xl h-9 px-4 text-xs cursor-pointer gap-1.5 border border-border/70"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-emerald-500" />}
                Pratinjau Hasil
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-9 px-5 text-xs shadow-xs cursor-pointer gap-1.5"
                onClick={handleApplyDirectly}
                disabled={loading || !prompt.trim()}
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                Generate & Terapkan
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
