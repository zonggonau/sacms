"use client"

import { useState } from "react"
import { Sparkles, Languages, FileText, Loader2, Wand2, Copy, Check, Bot, Search } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"

interface AIAssistantDialogProps {
  tenantSlug: string
  contentTypeSlug?: string
  fieldName?: string
  currentValue?: string
  onApply: (content: string) => void
  trigger?: React.ReactNode
}

export function AIAssistantDialog({
  tenantSlug,
  contentTypeSlug,
  fieldName = "Field",
  currentValue,
  onApply,
  trigger,
}: AIAssistantDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState("")
  const [prompt, setPrompt] = useState("")
  const [tone, setTone] = useState<string>("professional")
  const [targetLocale, setTargetLocale] = useState("id")
  const [correctInstruction, setCorrectInstruction] = useState<string>("grammar")
  const [copied, setCopied] = useState(false)
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt) return
    setLoading(true)
    try {
      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/generate` : `/api/tenant/${tenantSlug}/ai/generate`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          contentType: contentTypeSlug,
          fieldName,
          tone,
        }),
      })
      const data = await res.json()
      if (res.ok && data.content) {
        setResult(data.content)
      } else {
        // Fallback to content-assist
        const assistRes = await fetch(`/api/tenant/${tenantSlug}/ai/content-assist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate", prompt, tone, fieldSlug: fieldName })
        })
        const assistData = await assistRes.json()
        if (assistData.result) {
          setResult(assistData.result)
        } else {
          throw new Error(data.error || "Gagal membuat konten")
        }
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCorrect = async () => {
    const textToCorrect = prompt || currentValue
    if (!textToCorrect) return
    setLoading(true)
    try {
      const assistRes = await fetch(`/api/tenant/${tenantSlug}/ai/content-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "improve",
          prompt: correctInstruction,
          content: textToCorrect,
          tone,
        })
      })
      const assistData = await assistRes.json()
      if (assistData.result) {
        setResult(assistData.result)
      } else {
        throw new Error("Gagal memperbaiki teks")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleTranslate = async () => {
    if (!currentValue && !prompt) return
    setLoading(true)
    try {
      const assistRes = await fetch(`/api/tenant/${tenantSlug}/ai/content-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "translate",
          content: currentValue || prompt,
          targetLanguage: targetLocale,
        })
      })
      const assistData = await assistRes.json()
      if (assistData.result) {
        setResult(assistData.result)
      } else {
        throw new Error("Gagal menerjemahkan teks")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleSummarize = async () => {
    if (!currentValue) return
    setLoading(true)
    try {
      const assistRes = await fetch(`/api/tenant/${tenantSlug}/ai/content-assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "seo",
          content: currentValue,
        })
      })
      const assistData = await assistRes.json()
      if (assistData.result) {
        setResult(assistData.result)
      } else {
        throw new Error("Gagal membuat ringkasan SEO")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] font-bold rounded-lg text-primary hover:text-primary hover:bg-primary/10 transition-all flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Assist</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[620px] rounded-2xl border-border/80 bg-card p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                AI Content Assistant
                <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20 rounded-full">
                  {fieldName}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Tulis, perbaiki tata bahasa, terjemahkan, atau buat ringkasan konten secara instan dengan AI.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          <Tabs defaultValue="generate" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/40 border border-border/80 p-1 rounded-xl">
              <TabsTrigger value="generate" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Wand2 className="h-3.5 w-3.5" /> Buat Teks
              </TabsTrigger>
              <TabsTrigger value="correct" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Rapikan
              </TabsTrigger>
              <TabsTrigger value="translate" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5" /> Terjemahkan
              </TabsTrigger>
              <TabsTrigger value="summarize" className="rounded-lg font-bold text-xs py-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" /> Ringkasan
              </TabsTrigger>
            </TabsList>

            <div className="pt-3 space-y-3">
              <TabsContent value="generate" className="space-y-3 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Instruksi / Topik Konten</Label>
                  <Textarea
                    placeholder="Contoh: Tulis pengantar menarik tentang update layanan terbaru..."
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
                      <SelectTrigger className="h-8 text-xs rounded-xl w-36 border-border/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="professional" className="text-xs">Profesional</SelectItem>
                        <SelectItem value="formal" className="text-xs">Formal</SelectItem>
                        <SelectItem value="casual" className="text-xs">Santai & Ramah</SelectItem>
                        <SelectItem value="creative" className="text-xs">Kreatif</SelectItem>
                        <SelectItem value="technical" className="text-xs">Teknis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-4 text-xs font-bold shadow-xs" 
                    onClick={handleGenerate}
                    disabled={loading || !prompt}
                  >
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                    Generate
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="correct" className="space-y-3 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Teks yang Diproses</Label>
                  <Textarea
                    placeholder="Masukkan teks atau biarkan kosong untuk menggunakan nilai field saat ini..."
                    value={prompt || currentValue || ""}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="rounded-xl text-xs bg-background border-border/80 font-mono"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Gaya:</Label>
                    <Select value={correctInstruction} onValueChange={setCorrectInstruction}>
                      <SelectTrigger className="h-8 text-xs rounded-xl w-44 border-border/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="grammar" className="text-xs">Tata Bahasa & Ejaan</SelectItem>
                        <SelectItem value="professional" className="text-xs">Lebih Profesional</SelectItem>
                        <SelectItem value="casual" className="text-xs">Lebih Santai</SelectItem>
                        <SelectItem value="simple" className="text-xs">Sederhanakan Bahasa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-4 text-xs font-bold shadow-xs" 
                    onClick={handleCorrect}
                    disabled={loading || (!prompt && !currentValue)}
                  >
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                    Perbaiki
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="translate" className="space-y-3 mt-0">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Teks Sumber</Label>
                  <Textarea
                    placeholder="Masukkan teks atau biarkan menggunakan nilai field saat ini..."
                    value={prompt || currentValue || ""}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={3}
                    className="rounded-xl text-xs bg-background border-border/80"
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Bahasa Tujuan:</Label>
                    <Select value={targetLocale} onValueChange={setTargetLocale}>
                      <SelectTrigger className="h-8 text-xs rounded-xl w-36 border-border/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="id" className="text-xs">Indonesia (ID)</SelectItem>
                        <SelectItem value="en" className="text-xs">English (EN)</SelectItem>
                        <SelectItem value="ja" className="text-xs">Japanese (JA)</SelectItem>
                        <SelectItem value="zh" className="text-xs">Chinese (ZH)</SelectItem>
                        <SelectItem value="fr" className="text-xs">French (FR)</SelectItem>
                        <SelectItem value="de" className="text-xs">German (DE)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-4 text-xs font-bold shadow-xs" 
                    onClick={handleTranslate}
                    disabled={loading || (!prompt && !currentValue)}
                  >
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Languages className="mr-1.5 h-3.5 w-3.5" />}
                    Terjemahkan
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="summarize" className="space-y-3 mt-0">
                <div className="p-3 border border-border/60 rounded-xl bg-muted/20 text-xs max-h-28 overflow-y-auto">
                  {currentValue ? (
                    <p className="text-muted-foreground">{currentValue}</p>
                  ) : (
                    <p className="text-muted-foreground italic">Belum ada teks di field saat ini.</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-8 px-4 text-xs font-bold shadow-xs" 
                    onClick={handleSummarize}
                    disabled={loading || !currentValue}
                  >
                    {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-1.5 h-3.5 w-3.5" />}
                    Ringkas Konten
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>

          {result && (
            <div className="space-y-2 pt-2 border-t border-border/60 animate-in fade-in">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500" /> Hasil Asisten AI:
                </Label>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-2 text-[10px] font-bold">
                  {copied ? <Check className="mr-1 h-3 w-3 text-emerald-500" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copied ? "Tersalin" : "Salin"}
                </Button>
              </div>
              <div className="p-3 bg-muted/40 border border-border/80 rounded-xl max-h-40 overflow-y-auto font-mono text-xs text-foreground">
                <pre className="whitespace-pre-wrap font-sans text-xs">{result}</pre>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="rounded-xl h-8 text-xs font-bold">
            Batal
          </Button>
          <Button 
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 text-xs font-bold shadow-xs"
            disabled={!result}
            onClick={() => {
              onApply(result)
              setOpen(false)
              toast({ title: "Konten Diterapkan", description: `Teks telah dimasukkan ke ${fieldName}.` })
            }}
          >
            Terapkan ke Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
