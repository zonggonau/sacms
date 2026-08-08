"use client"

import { useState } from "react"
import { Sparkles, Loader2, Wand2, Copy, Check, Info } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AISmartFillProps {
  tenantSlug: string
  contentTypeName: string
  schema: any[]
  onApply: (data: Record<string, any>) => void
}

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
  const [language, setLanguage] = useState<string>("English")
  const { toast } = useToast()

  const handleGenerate = async () => {
    if (!prompt) return
    setLoading(true)
    try {
      // Create a simplified schema for AI
      const aiSchema = schema.map(f => ({
        slug: f.slug,
        name: f.name,
        type: f.type,
        required: f.required
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
      if (res.ok) {
        onApply(data.content)
        setOpen(false)
        setPrompt("")
        toast({ 
          title: "Smart Fill Complete!", 
          description: "AI has populated the form fields based on your input." 
        })
      } else {
        throw new Error(data.error || "Failed to process input")
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-bold rounded-none h-11 px-6 shadow-none transition-all hover:scale-105"
        >
          <Sparkles className="h-4 w-4 mr-2 text-emerald-500 fill-emerald-500" />
          AI Smart Fill
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] rounded-none border border-border bg-card text-card-foreground shadow-lg p-0 overflow-hidden">
        <div className="max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-black text-foreground">
              <Sparkles className="h-6 w-6 text-emerald-500 fill-emerald-500" />
              AI Smart Fill
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              Provide a draft or description, and AI will automatically populate all form fields for you.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="rounded-none font-medium h-10 bg-background border-border">
                    <SelectValue placeholder="Select Language" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border bg-card">
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Indonesian">Indonesian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tone</Label>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="rounded-none font-medium h-10 bg-background border-border">
                    <SelectValue placeholder="Select Tone" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border bg-card">
                    <SelectItem value="Professional">Professional</SelectItem>
                    <SelectItem value="Casual">Casual</SelectItem>
                    <SelectItem value="Enthusiastic">Enthusiastic</SelectItem>
                    <SelectItem value="Journalistic">Journalistic</SelectItem>
                    <SelectItem value="Funny">Funny</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-foreground">Paste your content or draft here:</Label>
              <Textarea
                placeholder="e.g., Write a blog post about the benefits of AI in CMS. The title should be catchy, and include a summary of 3 key benefits..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[200px] rounded-none border-border bg-background text-foreground focus-visible:ring-emerald-500 p-4 text-sm leading-relaxed"
              />
            </div>
            
            <div className="flex gap-3 p-4 bg-emerald-500/10 rounded-none border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
              <Info className="h-5 w-5 shrink-0 pt-0.5" />
              <p className="text-xs leading-relaxed font-medium">
                The AI will write and map content into the fields of this <strong>{contentTypeName}</strong>. You can manually review and edit the fields after generation.
              </p>
            </div>
          </div>
 
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-none font-bold">Cancel</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-none h-11 px-8 shadow-none shadow-none-emerald-100" 
              onClick={handleGenerate}
              disabled={loading || !prompt}
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate Content
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
