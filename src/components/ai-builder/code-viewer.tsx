"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileCode, Folder, Copy, Check, GitCompare, Code2, Search } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import ReactDiffViewer from "react-diff-viewer-continued"

interface CodeViewerProps {
  files: Array<{ name: string; content: string }>
  previousFiles?: Array<{ name: string; content: string }>
  selectedIndex?: number
  onSelectIndex?: (idx: number) => void
}

/**
 * Modern Multi-file code viewer with:
 * - File tree explorer with live filter
 * - VS Code Dark+ Prism Syntax Highlighting
 * - Git Diff Comparison view across design iterations
 */
export function CodeViewer({
  files,
  previousFiles = [],
  selectedIndex: controlledIndex,
  onSelectIndex,
}: CodeViewerProps) {
  const [internalIndex, setInternalIndex] = useState(0)
  const [copiedCode, setCopiedCode] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")
  const [viewMode, setViewMode] = useState<"code" | "diff">("code")
  const { toast } = useToast()

  const selectedFileIndex = controlledIndex !== undefined ? controlledIndex : internalIndex
  const handleSelect = (idx: number) => {
    if (onSelectIndex) onSelectIndex(idx)
    else setInternalIndex(idx)
  }

  const filteredFiles = useMemo(() => {
    if (!searchFilter.trim()) return files
    return files.filter(f => f.name.toLowerCase().includes(searchFilter.toLowerCase()))
  }, [files, searchFilter])

  const activeFile = files[selectedFileIndex] || files[0]
  const previousFile = useMemo(() => {
    if (!activeFile || previousFiles.length === 0) return null
    return previousFiles.find(f => f.name === activeFile.name) || null
  }, [activeFile, previousFiles])

  const hasDiff = Boolean(previousFile && previousFile.content !== activeFile?.content)

  const handleCopyCurrentCode = () => {
    if (activeFile) {
      navigator.clipboard.writeText(activeFile.content)
      setCopiedCode(true)
      toast({ title: "Kode Disalin", description: `${activeFile.name} telah disalin ke clipboard.` })
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const getLanguage = (fileName?: string) => {
    if (!fileName) return "typescript"
    if (fileName.endsWith(".tsx") || fileName.endsWith(".ts")) return "typescript"
    if (fileName.endsWith(".jsx") || fileName.endsWith(".js")) return "javascript"
    if (fileName.endsWith(".css")) return "css"
    if (fileName.endsWith(".json")) return "json"
    if (fileName.endsWith(".html")) return "html"
    return "typescript"
  }

  return (
    <div className="flex flex-1 overflow-hidden h-full">

      {/* File Tree Explorer (Left) */}
      <div className="w-56 lg:w-64 border-r border-border/60 bg-muted/20 p-2.5 space-y-2.5 shrink-0 flex flex-col justify-between overflow-hidden">
        <div className="space-y-2 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="h-3.5 w-3.5 text-primary" />
              Berkas ({files.length})
            </span>
            {hasDiff && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-amber-500/40 text-amber-500">
                Ada Perubahan
              </Badge>
            )}
          </div>

          {/* Quick Search in Tree */}
          {files.length > 5 && (
            <div className="relative">
              <Search className="h-3 w-3 absolute left-2 top-2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cari berkas..."
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                className="w-full h-7 pl-7 pr-2 rounded-md bg-background border border-border/60 text-[11px] placeholder:text-muted-foreground focus:outline-hidden focus:border-primary"
              />
            </div>
          )}

          <ScrollArea className="flex-1">
            <div className="space-y-0.5 pr-2">
              {filteredFiles.map((file) => {
                const originalIndex = files.findIndex(f => f.name === file.name)
                const isSelected = selectedFileIndex === originalIndex
                const fileHasDiff = previousFiles.length > 0 &&
                  previousFiles.some(pf => pf.name === file.name && pf.content !== file.content)
                const isNewFile = previousFiles.length > 0 &&
                  !previousFiles.some(pf => pf.name === file.name)

                return (
                  <button
                    key={file.name}
                    onClick={() => handleSelect(originalIndex)}
                    className={`flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/15 text-primary font-bold border border-primary/30"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <FileCode className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate flex-1">{file.name}</span>
                    {isNewFile && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="Berkas Baru" />
                    )}
                    {fileHasDiff && !isNewFile && (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" title="Telah Diubah" />
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyCurrentCode}
          className="w-full h-8 text-xs font-bold gap-1.5 rounded-lg border-border/80 cursor-pointer bg-background"
        >
          {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copiedCode ? "Tersalin!" : "Salin Kode"}</span>
        </Button>
      </div>

      {/* Code Display Panel (Right) */}
      <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden text-xs">
        {/* Sub-header */}
        <div className="h-9 border-b border-slate-800 bg-slate-900/80 px-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-200 font-mono text-xs font-semibold truncate">
              {activeFile?.name || "app/page.tsx"}
            </span>
            <Badge variant="outline" className="border-slate-700 text-slate-400 text-[10px] uppercase font-mono hidden sm:inline-flex">
              {getLanguage(activeFile?.name)}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Diff toggle if file has previous revision */}
            {hasDiff && (
              <div className="flex items-center bg-slate-800/80 rounded-md p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode("code")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    viewMode === "code"
                      ? "bg-slate-700 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Code2 className="h-3 w-3" />
                  Kode
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("diff")}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                    viewMode === "diff"
                      ? "bg-amber-500/20 text-amber-300 font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <GitCompare className="h-3 w-3" />
                  Perubahan (Diff)
                </button>
              </div>
            )}

            <span className="text-[10px] text-slate-500 font-mono hidden md:inline-block">
              {activeFile?.content.split("\n").length} baris
            </span>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto bg-[#1e1e1e]">
          {viewMode === "diff" && previousFile ? (
            <div className="text-xs p-2 font-mono">
              <ReactDiffViewer
                oldValue={previousFile.content}
                newValue={activeFile?.content || ""}
                splitView={false}
                useDarkTheme={true}
                leftTitle="Sebelum Revisi"
                rightTitle="Sesudah Revisi"
                styles={{
                  variables: {
                    dark: {
                      diffViewerBackground: "#1e1e1e",
                      diffViewerColor: "#d4d4d4",
                      addedBackground: "#1e3a1e",
                      addedColor: "#a3e635",
                      removedBackground: "#3a1e1e",
                      removedColor: "#f87171",
                      wordAddedBackground: "#2d5a2d",
                      wordRemovedBackground: "#5a2d2d",
                    },
                  },
                }}
              />
            </div>
          ) : (
            <SyntaxHighlighter
              language={getLanguage(activeFile?.name)}
              style={vscDarkPlus}
              showLineNumbers
              wrapLines
              customStyle={{
                margin: 0,
                padding: "1rem",
                background: "#1e1e1e",
                fontSize: "12px",
                lineHeight: "1.6",
                minHeight: "100%",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              }}
              lineNumberStyle={{
                minWidth: "2.5em",
                paddingRight: "1em",
                color: "#6e7681",
                textAlign: "right",
                userSelect: "none",
              }}
            >
              {activeFile?.content || "// Tidak ada berkas yang dipilih"}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  )
}

