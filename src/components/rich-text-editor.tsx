"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import "react-quill-new/dist/quill.snow.css"

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false })

const fullModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ indent: "-1" }, { indent: "+1" }],
    [{ align: [] }],
    ["link", "image"],
    ["blockquote", "code-block"],
    ["clean"],
  ],
}

const simpleModules = {
  toolbar: [
    ["bold", "italic", "underline"],
    [{ list: "ordered" }, { list: "bullet" }],
    ["link"],
    ["clean"],
  ],
}

const fullFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "list",
  "align",
  "link",
  "image",
  "blockquote",
  "code-block",
]

const simpleFormats = [
  "bold",
  "italic",
  "underline",
  "list",
  "link",
]

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
  simple?: boolean
  tenantSlug?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Mulai menulis...",
  minHeight = 260,
  simple = false,
  tenantSlug,
}: RichTextEditorProps) {
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAiOpen, setIsAiOpen] = useState(false)

  const handleGenerateAI = async () => {
    if (!aiPrompt.trim() || !tenantSlug) return
    setIsGenerating(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt, tone: "professional" })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to generate AI content")
      }

      const data = await res.json()
      // Append generated content
      const newValue = value ? `${value}<br/><br/>${data.content}` : data.content
      onChange(newValue)
      setIsAiOpen(false)
      setAiPrompt("")
      toast({ title: "AI Content Generated!" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "AI Error", description: err.message })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="bg-background relative group">
      {tenantSlug && (
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Dialog open={isAiOpen} onOpenChange={setIsAiOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 bg-white border-orange-500 text-orange-600 font-bold hover:bg-orange-50">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Ask AI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-none shadow-none border-border">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-orange-500" /> Generate with AI
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Textarea 
                  placeholder="What would you like me to write? (e.g., 'Write a 2 paragraph introduction about space exploration')"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  className="resize-none focus-visible:ring-orange-500 rounded-none border-border"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAiOpen(false)} className="rounded-none font-bold">Cancel</Button>
                <Button 
                  onClick={handleGenerateAI} 
                  disabled={!aiPrompt.trim() || isGenerating}
                  className="bg-orange-500 hover:bg-orange-600 rounded-none font-bold"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <ReactQuill
        theme="snow"
        value={value || ""}
        onChange={onChange}
        placeholder={placeholder}
        modules={simple ? simpleModules : fullModules}
        formats={simple ? simpleFormats : fullFormats}
      />
      <style jsx global>{`
        .ql-container {
          min-height: ${minHeight}px;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}
