"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/clipboard"

const STARTER_QUERY = "query WorkspaceRoot {\n  __typename\n}"

interface GraphiQLInnerProps {
  endpoint: string
  /** Pre-fills the sandbox's Headers panel, e.g. { Authorization: "Bearer cf_..." }. */
  headers?: Record<string, string>
}

export default function GraphiQLInner({ endpoint, headers }: GraphiQLInnerProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Apollo's sandbox is only ever served from a mutable "_latest" alias —
  // there's no versioned/pinned path on their CDN to lock this script to
  // (checked directly against their hosting: no SRI-friendly fixed-version
  // URL exists). Since the script can't be pinned, it shouldn't carry the
  // operator's session by default: includeCookies starts off, so a
  // tampered/compromised script can't fire authenticated mutations just
  // because this tab is open — the operator has to deliberately opt in
  // each time they actually want to run something against real tenant data.
  const [includeCookies, setIncludeCookies] = useState(false)

  const isMountedRef = useRef(true)
  // A stable primitive the effect can depend on — the caller isn't
  // required to memoize the `headers` object for this to only re-init the
  // sandbox when its actual content (e.g. the token) changes.
  const headersKey = JSON.stringify(headers || {})

  useEffect(() => {
    isMountedRef.current = true
    let sandbox: any

    const loadSandbox = () => {
      // Avoid multiple scripts
      if (!document.querySelector('script[src*="embeddable-sandbox"]')) {
        const script = document.createElement("script")
        script.src = "https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"
        script.async = true
        script.onload = initSandbox
        script.onerror = () => {
          if (isMountedRef.current) {
            setError("Failed to load Apollo Sandbox script. Please check your internet connection or disable adblockers.")
          }
        }
        document.head.appendChild(script)
      } else {
        if ((window as any).EmbeddedSandbox) {
          initSandbox()
        } else {
          // Wait for script to finish loading if it's already in DOM but not executed
          const existingScript = document.querySelector('script[src*="embeddable-sandbox"]')
          if (existingScript) {
            existingScript.addEventListener('load', initSandbox)
          }
        }
      }
    }

    const initSandbox = () => {
      if (!isMountedRef.current) return
      if ((window as any).EmbeddedSandbox && containerRef.current) {
        // Clear previous contents to prevent duplicate wrappers in React StrictMode
        containerRef.current.innerHTML = ""
        try {
          sandbox = new (window as any).EmbeddedSandbox({
            target: containerRef.current,
            initialEndpoint: endpoint,
            initialState: {
              document: STARTER_QUERY,
              variables: {},
              headers: JSON.parse(headersKey),
              includeCookies,
              pollForSchemaUpdates: false
            }
          })
        } catch (e) {
          console.error("Error initializing EmbeddedSandbox:", e)
        }
      }
    }

    loadSandbox()

    return () => {
      isMountedRef.current = false
      if (sandbox) {
        try {
          sandbox.dispose()
        } catch (e) {
          console.error("Error disposing EmbeddedSandbox:", e)
        }
      }

      const existingScript = document.querySelector('script[src*="embeddable-sandbox"]')
      if (existingScript) {
        existingScript.removeEventListener('load', initSandbox)
      }
    }
  }, [endpoint, includeCookies, headersKey])

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-red-500 p-8 text-center bg-card">
        {error}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <label className="flex min-w-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeCookies}
            onChange={(e) => setIncludeCookies(e.target.checked)}
            className="h-3.5 w-3.5 shrink-0"
          />
          Jalankan dengan sesi login saya
        </label>
        <Button type="button" variant="ghost" size="sm" onClick={() => copyToClipboard(STARTER_QUERY)}>
          Salin contoh kueri
        </Button>
      </div>
      <div ref={containerRef} className="min-h-0 w-full flex-1" />
    </div>
  )
}
