"use client"

import { useState } from "react"
import { Sparkles, Languages, FileText, Loader2, Wand2, Copy, Check } from "lucide-react"
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
  fieldName,
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
      if (res.ok) {
        setResult(data.content)
      } else {
        throw new Error(data.error || "Failed to generate")
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
      let finalPrompt = ""
      if (correctInstruction === "grammar") {
        finalPrompt = `Please check spelling, grammar, and typos, and fix them. Do not change the original style: ${textToCorrect}`
      } else if (correctInstruction === "professional") {
        finalPrompt = `Rewrite the following text to sound more professional and polished: ${textToCorrect}`
      } else if (correctInstruction === "casual") {
        finalPrompt = `Rewrite the following text to sound more casual, friendly, and conversational: ${textToCorrect}`
      } else if (correctInstruction === "simple") {
        finalPrompt = `Simplify the language of the following text so that it is easier to read and understand: ${textToCorrect}`
      } else {
        finalPrompt = `Improve the following text: ${textToCorrect}`
      }

      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/generate` : `/api/tenant/${tenantSlug}/ai/generate`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          contentType: contentTypeSlug,
          fieldName,
          tone,
          mode: "correct",
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.content)
      } else {
        throw new Error(data.error || "Failed to correct content")
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
      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/translate` : `/api/tenant/${tenantSlug}/ai/translate`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentValue || prompt,
          targetLocale,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.content)
      } else {
        throw new Error(data.error || "Failed to translate")
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
      const isGlobal = tenantSlug === "global"
      const url = isGlobal ? `/api/admin/ai/summarize` : `/api/tenant/${tenantSlug}/ai/summarize`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentValue,
          maxLength: 300,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data.content)
      } else {
        throw new Error(data.error || "Failed to summarize")
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
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-500" />
            AI Content Assistant
          </DialogTitle>
          <DialogDescription>
            Enhance your content using AI power. Generate, translate, summarize, or correct in seconds.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="generate" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Generate
            </TabsTrigger>
            <TabsTrigger value="correct" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Correct
            </TabsTrigger>
            <TabsTrigger value="translate" className="flex items-center gap-2">
              <Languages className="h-4 w-4" /> Translate
            </TabsTrigger>
            <TabsTrigger value="summarize" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Summarize
            </TabsTrigger>
          </TabsList>

          <div className="py-4 space-y-4">
            <TabsContent value="generate" className="space-y-4">
              <div className="space-y-2">
                <Label>What should I write about?</Label>
                <Textarea
                  placeholder="e.g., Write a catchy headline for a summer sale..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Tone</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="mt-auto bg-emerald-600 hover:bg-emerald-700" 
                  onClick={handleGenerate}
                  disabled={loading || !prompt}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  Generate
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="correct" className="space-y-4">
              <div className="space-y-2">
                <Label>Text to Correct / Polish</Label>
                <Textarea
                  placeholder="Enter text or use current field value..."
                  value={prompt || currentValue || ""}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Correction Mode</Label>
                  <Select value={correctInstruction} onValueChange={setCorrectInstruction}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grammar">Grammar & Spelling Only</SelectItem>
                      <SelectItem value="professional">Rewrite Professionally</SelectItem>
                      <SelectItem value="casual">Rewrite Casually</SelectItem>
                      <SelectItem value="simple">Simplify Language</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="mt-auto bg-emerald-600 hover:bg-emerald-700" 
                  onClick={handleCorrect}
                  disabled={loading || (!prompt && !currentValue)}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Correct
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="translate" className="space-y-4">
              <div className="space-y-2">
                <Label>Text to Translate</Label>
                <Textarea
                  placeholder="Enter text or use current field value..."
                  value={prompt || currentValue || ""}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1 space-y-2">
                  <Label>Target Language</Label>
                  <Select value={targetLocale} onValueChange={setTargetLocale}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="id">Indonesian</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  className="mt-auto bg-emerald-600 hover:bg-emerald-700" 
                  onClick={handleTranslate}
                  disabled={loading || (!prompt && !currentValue)}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Languages className="mr-2 h-4 w-4" />}
                  Translate
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="summarize" className="space-y-4">
              <div className="p-4 border rounded-none bg-muted/50 text-sm">
                {currentValue ? (
                  <p className="line-clamp-3">{currentValue}</p>
                ) : (
                  <p className="text-muted-foreground italic">No content in the current field to summarize.</p>
                )}
              </div>
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700" 
                onClick={handleSummarize}
                disabled={loading || !currentValue}
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Summarize Content
              </Button>
            </TabsContent>
          </div>
        </Tabs>
 
        {result && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-emerald-600 font-semibold">AI Result</Label>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 text-xs">
                {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                Copy
              </Button>
            </div>
            <div className="p-4 border-2 border-emerald-100 rounded-none bg-emerald-50/30 max-h-[200px] overflow-y-auto text-sm whitespace-pre-wrap">
              {result}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button 
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!result}
            onClick={() => {
              onApply(result)
              setOpen(false)
            }}
          >
            Apply to Field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
