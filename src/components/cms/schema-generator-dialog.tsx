"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, Wand2, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SchemaGeneratorDialogProps {
  tenantSlug: string
  type: "schema" | "single-type" | "component"
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SchemaGeneratorDialog({
  tenantSlug,
  type,
  open,
  onOpenChange,
  onSuccess,
}: SchemaGeneratorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const typeLabels = {
    "schema": "Collection Type",
    "single-type": "Single Type",
    "component": "Component"
  }

  const apiEndpoints = {
    "schema": `/api/tenant/${tenantSlug}/ai/generate-schema`,
    "single-type": `/api/tenant/${tenantSlug}/ai/generate-single-type`,
    "component": `/api/tenant/${tenantSlug}/ai/generate-component`
  }

  const handleGenerate = async () => {
    if (!prompt) return
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(apiEndpoints[type], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast({ 
          title: "AI Success!", 
          description: `${typeLabels[type]} "${data.name}" has been generated. Redirecting...`,
          className: "bg-emerald-50 border-emerald-200 text-emerald-800"
        })
        
        onOpenChange(false)
        setPrompt("")
        
        if (onSuccess) {
          onSuccess()
        } else {
          // Default redirect
          const pathMap = {
            "schema": "content-types",
            "single-type": "single-types",
            "component": "components"
          }
          router.push(`/dashboard/${tenantSlug}/${pathMap[type]}/edit/${data.slug}`)
        }
      } else {
        setError(data.error || "Failed to generate schema. Please try again.")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      toast({ variant: "destructive", title: "AI Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight">AI {typeLabels[type]} Generator</DialogTitle>
              <DialogDescription className="text-emerald-50/80 font-medium">
                Describe what you want to build, and AI will architect the schema for you.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-card">
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">
              What kind of {typeLabels[type].toLowerCase()} do you need?
            </Label>
            <Textarea
              placeholder={
                type === "schema" 
                  ? "e.g., Create a Blog Post schema with title, rich text content, featured image, author name, and published date..."
                  : type === "single-type"
                  ? "e.g., A Landing Page configuration with hero title, subtitle, CTA text, and a primary color field..."
                  : "e.g., A pricing card component with plan name, price, list of features, and is_popular toggle..."
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[150px] bg-muted/30 border-none rounded-2xl p-5 text-sm font-medium focus-visible:ring-emerald-500/20"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex gap-3 text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Architecture</p>
              <p className="text-[11px] text-emerald-800/70 leading-tight">AI will auto-generate fields, slugs, and data types.</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest mb-1">Time Saver</p>
              <p className="text-[11px] text-emerald-800/70 leading-tight">Generate complex structures in under 10 seconds.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-muted/10 border-t gap-3 shrink-0">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold px-6 h-12"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 h-12"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Architecting...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                Generate {typeLabels[type]}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
