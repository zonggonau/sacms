"use client"

import { useState } from "react"
import {
  Sparkles,
  Bot,
  Wand2,
  Globe,
  FileSearch,
  Loader2,
  Check,
  Copy,
  RefreshCw,
  ArrowRight
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface AiContentAssistantModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldSlug: string
  fieldName?: string
  currentValue?: string
  tenantSlug: string
  onApply: (newContent: string) => void
  availableLocales?: Array<{ locale: string; name: string }>
}

export function AiContentAssistantModal({
  open,
  onOpenChange,
  fieldSlug,
  fieldName = "Field",
  currentValue = "",
  tenantSlug,
  onApply,
  availableLocales = [
    { locale: "id", name: "Bahasa Indonesia" }
  ]
}: AiContentAssistantModalProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState("generate")
  const [prompt, setPrompt] = useState("")
  const [tone, setTone] = useState("formal")
  const [targetLang, setTargetLang] = useState(availableLocales[0]?.locale || "id")
  const [generatedResult, setGeneratedResult] = useState("")
  const [loading, setLoading] = useState(false)

  const handleRunAi = async (action: "generate" | "improve" | "translate" | "seo") => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai/content-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          prompt,
          content: currentValue || prompt,
          targetLanguage: targetLang,
          tone,
          fieldSlug,
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setGeneratedResult(data.result)
        toast({ title: "AI Selesai", description: "Hasil telah dibuat dan siap diterapkan ke field." })
      } else {
        toast({ variant: "destructive", title: "Gagal", description: data.error || "Gagal menghubungi asisten AI" })
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan", description: "Terjadi kesalahan jaringan" })
    } finally {
      setLoading(false)
    }
  }

  const handleApply = () => {
    if (!generatedResult) return
    onApply(generatedResult)
    onOpenChange(false)
    toast({ title: "Berhasil Diterapkan", description: `Konten telah dimasukkan ke field ${fieldName}.` })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-border/80 shadow-2xl bg-card sm:max-w-[640px] p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-gradient-to-r from-primary/5 to-purple-500/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                AI Content Assistant
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  {fieldName} ({fieldSlug})
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Gunakan kecerdasan buatan untuk menulis, memoles, menerjemahkan, atau membuat metadata SEO.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-xl w-full grid grid-cols-4">
              <TabsTrigger value="generate" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Bot className="w-3 h-3" /> Buat Teks
              </TabsTrigger>
              <TabsTrigger value="improve" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Wand2 className="w-3 h-3" /> Rapikan
              </TabsTrigger>
              <TabsTrigger value="translate" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Terjemahkan
              </TabsTrigger>
              <TabsTrigger value="seo" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <FileSearch className="w-3 h-3" /> Auto SEO
              </TabsTrigger>
            </TabsList>

            {/* TAB: GENERATE */}
            <TabsContent value="generate" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Instruksi / Topik Konten</Label>
                <Textarea
                  placeholder="Contoh: Tulis 3 paragraf pengantar tentang peluncuran fitur terbaru SaaS kami..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="rounded-xl text-xs bg-background border-border/80"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Tone:</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="h-8 text-xs rounded-lg w-32 border-border/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="formal" className="text-xs">Formal / Profesional</SelectItem>
                      <SelectItem value="casual" className="text-xs">Santai & Ramah</SelectItem>
                      <SelectItem value="persuasive" className="text-xs">Persuasif & Marketing</SelectItem>
                      <SelectItem value="technical" className="text-xs">Teknis & Ringkas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={loading || !prompt.trim()}
                  onClick={() => handleRunAi("generate")}
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Generate Konten
                </Button>
              </div>
            </TabsContent>

            {/* TAB: IMPROVE */}
            <TabsContent value="improve" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Teks yang Sedang Diedit</Label>
                <div className="p-2.5 bg-muted/30 border border-border/60 rounded-xl text-xs text-muted-foreground max-h-24 overflow-y-auto font-mono">
                  {currentValue || "(Field saat ini masih kosong. Ketik teks di form atau ketik instruksi tambahan di bawah)"}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Petunjuk Perbaikan Tambahan (Opsional)</Label>
                <Input
                  placeholder="Contoh: Perbaiki tata bahasa dan buat paragraf lebih mengalir..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="h-9 text-xs rounded-xl border-border/80"
                />
              </div>
              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={loading || (!currentValue && !prompt.trim())}
                  onClick={() => handleRunAi("improve")}
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
                  Poles & Rapikan
                </Button>
              </div>
            </TabsContent>

            {/* TAB: TRANSLATE */}
            <TabsContent value="translate" className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Pilih Bahasa Target</Label>
                <Select value={targetLang} onValueChange={setTargetLang}>
                  <SelectTrigger className="h-9 text-xs rounded-xl border-border/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {availableLocales.map((loc) => (
                      <SelectItem key={loc.locale} value={loc.locale} className="text-xs">
                        {loc.name} ({loc.locale.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={loading || !currentValue}
                  onClick={() => handleRunAi("translate")}
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Globe className="w-3.5 h-3.5 mr-1.5" />}
                  Terjemahkan
                </Button>
              </div>
            </TabsContent>

            {/* TAB: SEO */}
            <TabsContent value="seo" className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                AI akan membaca draf konten Anda dan membuat rekomendasi Meta Title dan Meta Description yang optimal untuk SEO.
              </p>
              <div className="flex items-center justify-end">
                <Button
                  size="sm"
                  disabled={loading || !currentValue}
                  onClick={() => handleRunAi("seo")}
                  className="h-8 px-4 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileSearch className="w-3.5 h-3.5 mr-1.5" />}
                  Buat Meta SEO
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {/* AI Result Area */}
          {generatedResult && (
            <div className="space-y-2 pt-2 border-t border-border/60 animate-in fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Hasil Asisten AI:
                </Label>
                <span className="text-[10px] text-muted-foreground">Periksa dan sesuaikan sebelum menerapkan</span>
              </div>
              <div className="p-3 bg-muted/40 border border-border/80 rounded-xl max-h-48 overflow-y-auto font-mono text-xs text-foreground">
                <pre className="whitespace-pre-wrap font-sans text-xs">{generatedResult}</pre>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border/60">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs font-bold">
              Batal
            </Button>
            {generatedResult && (
              <Button
                onClick={handleApply}
                className="h-8 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <ArrowRight className="w-3.5 h-3.5 mr-1.5" /> Terapkan ke Field
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
