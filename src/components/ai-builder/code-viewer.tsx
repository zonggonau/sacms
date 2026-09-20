"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileCode, Folder, Copy, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CodeViewerProps {
  files: Array<{ name: string; content: string }>
}

/**
 * Multi-file code viewer with a file tree explorer and code display.
 * Extracted from the monolith's "Code" tab.
 */
export function CodeViewer({ files }: CodeViewerProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  const { toast } = useToast()

  const handleCopyCurrentCode = () => {
    const activeFile = files[selectedFileIndex]
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content)
      setCopiedCode(true)
      toast({ title: "Kode Disalin", description: `${activeFile.name} telah disalin ke clipboard.` })
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* File Tree Explorer (Left) */}
      <div className="w-56 border-r border-border/60 bg-background/50 p-3 space-y-3 shrink-0 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Folder className="h-3.5 w-3.5 text-primary" />
            Berkas Proyek
          </span>

          <div className="space-y-1">
            {files.map((file, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedFileIndex(idx)}
                className={`flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  selectedFileIndex === idx
                    ? "bg-primary/10 text-primary font-bold border border-primary/20"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <FileCode className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyCurrentCode}
          className="w-full h-8 text-xs font-bold gap-1.5 rounded-xl border-border/80"
        >
          {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedCode ? "Tersalin!" : "Salin Kode"}</span>
        </Button>
      </div>

      {/* Code Display Panel (Right) */}
      <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-mono text-xs">
        <div className="h-9 border-b border-slate-800 bg-slate-900/60 px-4 flex items-center justify-between shrink-0">
          <span className="text-slate-400 text-xs font-bold">
            {files[selectedFileIndex]?.name || "app/page.tsx"}
          </span>
          <span className="text-[10px] text-slate-500">TypeScript / React 19 / Next.js 16</span>
        </div>

        <ScrollArea className="flex-1 p-4">
          <pre className="leading-relaxed whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
            {files[selectedFileIndex]?.content}
          </pre>
        </ScrollArea>
      </div>
    </div>
  )
}
