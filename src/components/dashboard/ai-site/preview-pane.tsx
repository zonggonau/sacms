"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type PreviewState =
  | { status: "starting" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string }

/**
 * Asks the server to sync the project into its sandbox and (re)start the dev
 * server, then shows it. Runs again whenever `revision` changes, i.e. after
 * each generation.
 */
export function PreviewPane({
  tenantSlug,
  projectId,
  revision,
  onUrlChange,
}: {
  tenantSlug: string
  projectId: string
  revision: number
  onUrlChange: (url: string | null) => void
}) {
  const [state, setState] = useState<PreviewState>({ status: "starting" })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((current) => (current.status === "ready" ? current : { status: "starting" }))

    fetch(`/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/projects/${encodeURIComponent(projectId)}/preview`, {
      method: "POST",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as { url?: string; message?: string; error?: string } | null
        if (!response.ok || !body?.url) throw new Error(body?.message || body?.error || "The preview could not start.")
        return body.url
      })
      .then((url) => {
        if (cancelled) return
        setState({ status: "ready", url })
        onUrlChange(url)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "The preview could not start.",
        })
        onUrlChange(null)
      })

    return () => {
      cancelled = true
    }
  }, [tenantSlug, projectId, revision, attempt, onUrlChange])

  if (state.status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="max-w-md text-sm text-muted-foreground">{state.message}</p>
        <Button onClick={() => setAttempt((value) => value + 1)} size="sm" variant="outline">
          Coba lagi
        </Button>
      </div>
    )
  }

  if (state.status === "starting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Memulai preview… Permulaan pertama menginstal dependensi dan bisa butuh waktu semenit.
      </div>
    )
  }

  return (
    <iframe
      className="size-full border-0 bg-white"
      key={`${state.url}#${revision}`}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      src={state.url}
      title="Website preview"
    />
  )
}
