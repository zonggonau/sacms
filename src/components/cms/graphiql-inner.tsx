"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"

interface GraphiQLInnerProps {
  endpoint: string
}

export default function GraphiQLInner({ endpoint }: GraphiQLInnerProps) {
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
              // Introspection is disabled server-side for any caller the
              // GraphQL route doesn't grant mutation access to (viewer,
              // subscriber, author, contributor) — seeding an introspection
              // query by default made the playground fail validation
              // immediately for most roles. A plain placeholder works for
              // everyone; privileged roles can still introspect on demand.
              document: '# Write a query or mutation, then press the Run button.\\n',
              variables: {},
              headers: {},
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
  }, [endpoint, includeCookies])

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-red-500 p-8 text-center bg-card">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-background flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <label className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground border-b border-border shrink-0 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={includeCookies}
          onChange={(e) => setIncludeCookies(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Jalankan dengan sesi login saya (diperlukan untuk query/mutation sungguhan — nonaktif secara default demi keamanan)
      </label>
      <div ref={containerRef} className="w-full flex-1" style={{ width: '100%' }} />
    </div>
  )
}
