"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { aiPreviewText, fieldAiActions, getFieldAiMode, isAiFieldEmpty, normalizeAiFieldValue, type AiField, type AiFieldValue, type AiFormTarget, type FieldAiAction } from "@/lib/content/field-ai"

interface AIAssistantDialogProps {
  tenantSlug: string
  form: AiFormTarget
  field: AiField
  value: unknown
  context: Record<string, string>
  onApply: (suggestion: AiFieldValue) => void
}

const actionLabels: Record<FieldAiAction, string> = {
  generate: "Buat draf", improve: "Rapikan teks", summarize: "Ringkas",
  seo: "Sarankan SEO",
}


export function AIAssistantDialog({ tenantSlug, form, field, value, context, onApply }: AIAssistantDialogProps) {
  const actions = fieldAiActions(field, form)
  const isSeo = field.type === "seo"
  const polishOnly = getFieldAiMode(field, form) === "polish"
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<FieldAiAction>(actions[0] ?? "improve")
  const [prompt, setPrompt] = useState("")
  const [suggestions, setSuggestions] = useState<AiFieldValue[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  if (actions.length === 0) return null
  const actionLabel = isSeo && polishOnly ? "Rapikan SEO"
    : field.type === "text" && action === "generate" ? "Buat alternatif judul"
      : actionLabels[action]
  const hasValue = !isAiFieldEmpty(value, field)
  const hasContext = Object.keys(context).length > 0
  const canGenerate = action === "generate" ? !!prompt.trim() || hasContext
    : action === "seo" ? (polishOnly ? hasValue : hasContext || hasValue || !!prompt.trim())
      : hasValue

  function changeOpen(next: boolean) {
    if (loading) return
    setOpen(next)
    if (!next) {
      setPrompt("")
      setSuggestions([])
      setSelected(0)
      setError("")
    }
  }

  async function generate() {
    if (loading || !canGenerate) return
    setLoading(true)
    setError("")
    setSuggestions([])
    try {
      const seoValue = isSeo && hasValue && typeof value === "object" && value !== null
        ? value as Record<string, unknown> : null
      const content = typeof value === "string" ? value.slice(0, 24000)
        : seoValue ? JSON.stringify({
          meta_title: typeof seoValue.meta_title === "string" ? seoValue.meta_title.slice(0, 240) : undefined,
          meta_description: typeof seoValue.meta_description === "string" ? seoValue.meta_description.slice(0, 640) : undefined,
        }) : undefined
      const response = await fetch("/api/tenant/" + encodeURIComponent(tenantSlug) + "/ai/content-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form, fieldSlug: field.slug, action, prompt,
          content, context: polishOnly ? {} : context,
        }),
      })
      const data = await response.json()
      if (!response.ok || !Array.isArray(data.suggestions)) throw new Error(data.error || "AI Assist gagal.")
      const nextSuggestions = data.suggestions.flatMap((item: unknown) => {
        const suggestion = normalizeAiFieldValue(field, item)
        return suggestion === null ? [] : [suggestion]
      })
      if (!nextSuggestions.length) throw new Error("AI tidak menghasilkan saran yang sesuai.")
      setSelected(0)
      setSuggestions(nextSuggestions)
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Assist gagal.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] font-bold text-primary"
          aria-label={(isSeo ? (polishOnly ? "Rapikan SEO" : "Sarankan SEO") : "AI Assist") + " untuk " + field.name}>
          <Sparkles className="size-3.5" aria-hidden="true" />
          {isSeo ? (polishOnly ? "Rapikan SEO" : "Sarankan SEO") : "AI Assist"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{field.name}</DialogTitle>
          <DialogDescription>Tinjau saran AI sebelum menerapkannya ke field.</DialogDescription>
        </DialogHeader>

        {actions.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="field-ai-action">Aksi AI</Label>
            <Select value={action} disabled={loading} onValueChange={(next: FieldAiAction) => {
              setAction(next)
              setPrompt("")
              setSuggestions([])
              setError("")
            }}>
              <SelectTrigger id="field-ai-action" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {actions.map((item) => <SelectItem key={item} value={item}>
                  {item === "generate" && field.type === "text" ? "Buat alternatif judul" : actionLabels[item]}
                </SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {(action === "generate" || (action === "seo" && !polishOnly)) && (
          <div className="space-y-1.5">
            <Label htmlFor="field-ai-source">Informasi sumber</Label>
            <Textarea id="field-ai-source" value={prompt} onChange={(event) => {
              setPrompt(event.target.value)
              setSuggestions([])
              setError("")
            }}
              placeholder="Tambahkan fakta atau arahan penulisan" disabled={loading} maxLength={4000} rows={3} />
          </div>
        )}

        {!canGenerate && <p className="text-sm text-muted-foreground">Isi teks atau informasi sumber terlebih dahulu.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {suggestions.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">Pratinjau saran</legend>
            <RadioGroup
              className="gap-2"
              value={String(selected)}
              onValueChange={(v) => setSelected(Number(v))}
            >
              {suggestions.map((suggestion, index) => (
                <label key={index} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                  {suggestions.length > 1 && <RadioGroupItem value={String(index)} className="mt-1" />}
                  {typeof suggestion === "string"
                    ? <span className="whitespace-pre-wrap break-words">{aiPreviewText(suggestion, field)}</span>
                    : <span><strong>{suggestion.meta_title}</strong><br />{suggestion.meta_description}</span>}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => changeOpen(false)}>Batal</Button>
          <Button type="button" variant="outline" disabled={!canGenerate || loading} onClick={generate}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {actionLabel}
          </Button>
          {suggestions[selected] && <Button type="button" onClick={() => {
            onApply(suggestions[selected])
            changeOpen(false)
          }}>Terapkan ke Field</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
