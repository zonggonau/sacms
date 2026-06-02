"use client"

import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"

interface GraphiQLInnerProps {
  endpoint: string
  apiToken?: string
}

export default function GraphiQLInner({ endpoint, apiToken }: GraphiQLInnerProps) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let sandbox: any

    const loadSandbox = () => {
      // Avoid multiple scripts
      if (!document.querySelector('script[src*="embeddable-sandbox"]')) {
        const script = document.createElement("script")
        script.src = "https://embeddable-sandbox.cdn.apollographql.com/_latest/embeddable-sandbox.umd.production.min.js"
        script.async = true
        script.onload = initSandbox
        script.onerror = () => setError("Failed to load Apollo Sandbox script. Please check your internet connection or disable adblockers.")
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
      if ((window as any).EmbeddedSandbox && containerRef.current) {
        sandbox = new (window as any).EmbeddedSandbox({
          target: containerRef.current,
          initialEndpoint: endpoint,
          initialState: {
            document: 'query {\\n  __schema {\\n    types {\\n      name\\n      kind\\n    }\\n  }\\n}',
            variables: {},
            headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
            includeCookies: false,
            pollForSchemaUpdates: false
          }
        })
      }
    }

    loadSandbox()

    return () => {
      if (sandbox) {
        sandbox.dispose()
      }
    }
  }, [endpoint, apiToken])

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-red-500 p-8 text-center bg-card">
        {error}
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-background" style={{ minHeight: 'calc(100vh - 4rem)' }}>
      <div ref={containerRef} className="w-full h-full" style={{ height: '100%', width: '100%' }} />
    </div>
  )
}
