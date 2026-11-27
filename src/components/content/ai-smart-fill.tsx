"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { aiFormContext, aiPreviewText, isAiFieldEmpty, normalizeAiFieldValue, smartFillFields, visibleAiFields, SMART_FILL_CREDIT_COST, type AiField, type AiFieldValue, type AiFormTarget } from "@/lib/content/field-ai"

interface AISmartFillProps {
  tenantSlug: string
  form: AiFormTarget
  contentTypeName: string
  schema: AiField[]
  currentValues: Record<string, unknown>
  onApply: (data: Record<string, AiFieldValue>) => void
}

function describe(value: unknown, field: AiField) {
  if (isAiFieldEmpty(value, field)) return "Kosong"
  if (typeof value === "string") {
    return aiPreviewText(value, field)
  }
  if (field.type === "seo" && value && typeof value === "object") {
    const seo = value as Record<string, unknown>
    return [seo.meta_title, seo.meta_description].filter((item) => typeof item === "string" && item).join("\n")
  }
  return String(value)
}

export function AISmartFill({ tenantSlug, form, contentTypeName, schema, currentValues, onApply }: AISmartFillProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [includeFilled, setIncludeFilled] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, AiFieldValue> | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState("")
  const eligible = smartFillFields(visibleAiFields(schema, currentValues), form)
  if (eligible.length === 0) return null

  const overwrite = (field: AiField) => !isAiFieldEmpty(currentValues[field.slug], field)
  const candidates = eligible.filter((field) => includeFilled || !overwrite(field)).slice(0, 64)
  const context = aiFormContext(schema, currentValues, form)
  const canGenerate = candidates.length > 0 && (!!prompt.trim() || Object.keys(context).length > 0)
  const proposed = eligible.filter((field) => suggestions?.[field.slug] != null)

  function changeOpen(next: boolean) {
    if (loading) return
    setOpen(next)
    if (!next) {
      setPrompt("")
      setSuggestions(null)
      setSelected([])
      setIncludeFilled(false)
      setError("")
    }
  }

  async function generate() {
    if (loading || !canGenerate) return
    setLoading(true)
    setSuggestions(null)
    setSelected([])
    setError("")
    try {
      const response = await fetch("/api/tenant/" + encodeURIComponent(tenantSlug) + "/ai/smart-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, fieldSlugs: candidates.map((field) => field.slug), prompt, context }),
      })
      const data = await response.json()
      if (!response.ok || !data.content) throw new Error(data.error || "Smart Fill gagal.")
      const result = Object.fromEntries(candidates.flatMap((field) => {
        const suggestion = normalizeAiFieldValue(field, data.content[field.slug])
        return suggestion === null ? [] : [[field.slug, suggestion]]
      }))
      if (Object.keys(result).length === 0) throw new Error("AI tidak menghasilkan saran yang sesuai.")
      setSuggestions(result)
      setSelected(candidates.filter((field) => field.slug in result && !overwrite(field)).map((field) => field.slug))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Smart Fill gagal.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-9 gap-1.5 bg-emerald-500/10 px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          <Sparkles className="size-4" aria-hidden="true" /> AI Smart Fill
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>AI Smart Fill</DialogTitle>
          <DialogDescription>Pilih saran yang ingin diterapkan ke formulir {contentTypeName}.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="smart-fill-brief">Informasi sumber</Label>
          <Textarea id="smart-fill-brief" rows={3} maxLength={4000} disabled={loading}
            placeholder="Masukkan fakta atau arahan penulisan" value={prompt}
            onChange={(event) => { setPrompt(event.target.value); setSuggestions(null); setSelected([]) }} />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="smart-fill-include-filled" checked={includeFilled} disabled={loading}
            onCheckedChange={(value) => { setIncludeFilled(value === true); setSuggestions(null); setSelected([]) }} />
          <Label htmlFor="smart-fill-include-filled">Sertakan field yang sudah berisi</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {SMART_FILL_CREDIT_COST} kredit per generasi. Meninjau dan menerapkan saran tidak memakai kredit tambahan.
        </p>
        {candidates.length === 0 && <p className="text-sm text-muted-foreground">Semua field penulisan sudah terisi.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {suggestions && (
          <fieldset className="max-h-[40dvh] space-y-2 overflow-y-auto pr-1">
            <legend className="mb-2 text-sm font-semibold">Pratinjau hasil</legend>
            {proposed.map((field, index) => (
              <div key={field.slug} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox id={"smart-fill-result-" + index} checked={selected.includes(field.slug)}
                    onCheckedChange={(checked) => setSelected((previous) => checked === true
                      ? [...previous, field.slug] : previous.filter((slug) => slug !== field.slug))} />
                  <Label htmlFor={"smart-fill-result-" + index}>{field.name}</Label>
                  {overwrite(field) && <span className="text-xs text-amber-700 dark:text-amber-400">Mengganti isi</span>}
                </div>
                <dl className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="min-w-0"><dt className="font-medium text-muted-foreground">Saat ini</dt>
                    <dd className="whitespace-pre-wrap break-words">{describe(currentValues[field.slug], field)}</dd></div>
                  <div className="min-w-0"><dt className="font-medium text-muted-foreground">Saran</dt>
                    <dd className="whitespace-pre-wrap break-words">{describe(suggestions[field.slug], field)}</dd></div>
                </dl>
              </div>
            ))}
          </fieldset>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => changeOpen(false)}>Batal</Button>
          <Button type="button" variant="outline" disabled={!canGenerate || loading} onClick={generate}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {suggestions ? "Buat ulang" : "Pratinjau hasil"}
          </Button>
          {suggestions && <Button type="button" disabled={selected.length === 0} onClick={() => {
            onApply(Object.fromEntries(proposed.filter((field) => selected.includes(field.slug)).map((field) => [field.slug, suggestions[field.slug]])))
            changeOpen(false)
          }}>Terapkan yang dipilih</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
