"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SandpackPreview } from "@/components/ai-builder/sandpack-preview"
import { Loader2, ArrowLeft, CheckCircle2, CircleDashed, Terminal, ExternalLink } from "lucide-react"
import Link from "next/link"

function AIBuilderRunner() {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get("prompt")
  
  const [logs, setLogs] = useState<{ step: number; message: string; status: 'pending' | 'done' | 'error' }[]>([
    { step: 1, message: "Designing database schema...", status: 'pending' }
  ])
  const [code, setCode] = useState<string | null>(null)
  const [tenantSlug, setTenantSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current || !initialPrompt) return
    hasStarted.current = true

    const generate = async () => {
      try {
        const response = await fetch('/api/ai-builder/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: initialPrompt })
        })

        if (!response.ok) {
          throw new Error('Failed to start generation')
        }

        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (!reader) throw new Error("No reader")

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\\n')
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.error) {
                  setError(data.error)
                  setLogs(prev => [...prev, { step: 99, message: data.error, status: 'error' }])
                  break
                }
                
                if (data.code) {
                  setCode(data.code)
                  setTenantSlug(data.tenantSlug)
                }

                setLogs(prev => {
                  const newLogs = [...prev]
                  if (newLogs.length > 0) {
                    newLogs[newLogs.length - 1].status = 'done'
                  }
                  if (data.message !== "Done!") {
                    newLogs.push({ step: data.step, message: data.message, status: 'pending' })
                  }
                  return newLogs
                })

              } catch (e) {
                console.error("Parse error", e)
              }
            }
          }
        }
      } catch (err: any) {
        setError(err.message)
      }
    }

    generate()
  }, [initialPrompt])

  if (!initialPrompt) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p>No prompt provided. <Link href="/ai-builder" className="text-orange-500 hover:underline">Go back</Link></p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Left Pane: Chat & Progress */}
      <div className="w-1/3 border-r border-zinc-800 flex flex-col bg-zinc-950">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <Link href="/ai-builder" className="flex items-center text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Builder
          </Link>
          <div className="text-xs font-mono px-2 py-1 bg-zinc-900 rounded border border-zinc-800 text-zinc-500">
            v0.dev clone
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Your Prompt</h3>
            <p className="text-sm font-medium leading-relaxed">{initialPrompt}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2 flex items-center">
              <Terminal className="w-3 h-3 mr-2" />
              Generation Progress
            </h3>
            
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {log.status === 'done' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : log.status === 'error' ? (
                    <CircleDashed className="w-4 h-4 text-red-500" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                  )}
                </div>
                <div>
                  <p className={\`text-sm font-medium \${log.status === 'pending' ? 'text-white' : 'text-zinc-400'}\`}>
                    {log.message}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 mt-6">
              <p className="text-sm text-red-400 font-medium">Error: {error}</p>
            </div>
          )}
          
          {tenantSlug && (
            <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-5 mt-8 space-y-3">
              <h3 className="text-sm font-bold text-emerald-500">Workspace Ready!</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your headless CMS workspace has been fully provisioned with the generated schema.
              </p>
              <Link 
                href={\`/dashboard/\${tenantSlug}\`}
                target="_blank"
                className="inline-flex items-center text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg transition-colors"
              >
                Open Dashboard <ExternalLink className="w-3 h-3 ml-1.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Right Pane: Code Preview */}
      <div className="w-2/3 flex flex-col bg-zinc-900 relative">
        {!code ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-700 mb-4" />
            <p className="text-sm font-medium">AI is writing code...</p>
          </div>
        ) : (
          <div className="flex-1 p-2">
            <SandpackPreview code={code} />
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIBuilderNewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-black flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>}>
      <AIBuilderRunner />
    </Suspense>
  )
}
