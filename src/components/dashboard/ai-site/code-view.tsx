"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type ProjectFile = { path: string; content: string }

/** Read-only view of the project's files as stored in the database. */
export function CodeView({ tenantSlug, projectId, revision }: { tenantSlug: string; projectId: string; revision: number }) {
  const [files, setFiles] = useState<ProjectFile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/projects/${encodeURIComponent(projectId)}/files`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { files?: ProjectFile[]; message?: string } | null
        if (!response.ok || !body?.files) throw new Error(body?.message || "Files could not be loaded.")
        return body.files
      })
      .then((next) => {
        if (cancelled) return
        setFiles(next)
        setSelected((current) =>
          current && next.some((file) => file.path === current)
            ? current
            : (next.find((file) => file.path === "app/page.tsx") ?? next[0])?.path ?? null,
        )
      })
      .catch((error: unknown) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Files could not be loaded.")
      })
    return () => {
      cancelled = true
    }
  }, [tenantSlug, projectId, revision])

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>
  if (!files) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const current = files.find((file) => file.path === selected)

  return (
    <div className="flex h-full min-h-0">
      <nav className="w-56 shrink-0 overflow-y-auto border-r border-border p-2">
        {files.map((file) => (
          <button
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground",
              file.path === selected && "bg-accent text-foreground",
            )}
            key={file.path}
            onClick={() => setSelected(file.path)}
            type="button"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{file.path}</span>
          </button>
        ))}
      </nav>
      <pre className="min-w-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed">
        {current?.content ?? ""}
      </pre>
    </div>
  )
}
