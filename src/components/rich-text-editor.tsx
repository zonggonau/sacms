"use client"

import dynamic from "next/dynamic"
import { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Sparkles, Loader2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import "react-quill-new/dist/quill.snow.css"
import * as Y from "yjs"
import { WebrtcProvider } from "y-webrtc"
import { QuillBinding } from "y-quill"
import QuillCursors from "quill-cursors"
import Quill from "quill"

if (!Quill.imports["modules/cursors"]) {
  Quill.register("modules/cursors", QuillCursors)
}

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false })
const ReactQuillAny = ReactQuill as any

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
  cursors: true,
  history: {
    // Disable native quill history since yjs handles it
    userOnly: true
  }
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
  documentId?: string
  fieldSlug?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Mulai menulis...",
  minHeight = 260,
  simple = false,
  tenantSlug,
  documentId,
  fieldSlug,
}: RichTextEditorProps) {
  const { data: session } = useSession()
  const [aiPrompt, setAiPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [isAiOpen, setIsAiOpen] = useState(false)
  const quillRef = useRef<any>(null)
  
  useEffect(() => {
    // Only setup CRDT if we have a document ID (e.g. editing a specific content entry)
    if (!documentId || !fieldSlug || !quillRef.current) return

    const editor = quillRef.current.getEditor()
    if (!editor) return

    const ydoc = new Y.Doc()
    
    // Setup WebRTC Provider
    const roomName = `sacms-room-${tenantSlug || 'global'}-${documentId}-${fieldSlug}`
    const provider = new WebrtcProvider(roomName, ydoc)
    
    const ytext = ydoc.getText("quill")
    const binding = new QuillBinding(ytext, editor, provider.awareness)
    
    // Populate editor with initial value if Yjs text is empty on mount
    if (ytext.toString().length === 0 && value) {
      setTimeout(() => {
        if (ytext.toString().length === 0 && value) {
          editor.clipboard.dangerouslyPasteHTML(0, value)
        }
      }, 50)
    }

    // Set user info for awareness
    if (session?.user) {
      provider.awareness.setLocalStateField("user", {
        name: session.user.name || "Anonymous",
        color: "#" + Math.floor(Math.random()*16777215).toString(16) // Random color
      })
    }
    
    return () => {
      binding.destroy()
      provider.destroy()
      ydoc.destroy()
    }
  }, [documentId, fieldSlug, tenantSlug, session?.user?.id, session?.user?.name])

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
      toast({ title: "Konten AI Berhasil Dibuat!" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Terjadi Kesalahan AI", description: err.message || "Gagal membuat konten dengan AI" })
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
              <Button size="sm" variant="outline" className="h-8 rounded-xl border-primary/30 text-primary font-bold hover:bg-primary/10">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Tanya AI
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl border-border/80 bg-card shadow-xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold">
                  <Sparkles className="w-4 h-4 text-primary" /> Buat Konten dengan AI
                </DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Textarea 
                  placeholder="Apa yang ingin Anda tulis? (Contoh: 'Tulis 2 paragraf pengantar tentang strategi headless CMS')"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={4}
                  className="resize-none rounded-xl border-border/80 text-xs leading-relaxed"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAiOpen(false)} className="rounded-xl text-xs font-semibold">Batal</Button>
                <Button 
                  onClick={handleGenerateAI} 
                  disabled={!aiPrompt.trim() || isGenerating}
                  className="rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-2" />}
                  Generate Konten
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <ReactQuillAny
        ref={quillRef}
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
