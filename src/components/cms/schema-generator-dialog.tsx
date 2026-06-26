"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, Wand2, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  tenantSlug?: string
  type: "schema" | "single-type" | "component" | "system"
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

import { aiTemplates } from "@/lib/ai-templates"

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
  const [generatedData, setGeneratedData] = useState<any>(null)
  const { toast } = useToast()
  const router = useRouter()

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setGeneratedData(null)
      setPrompt("")
      setError(null)
    }
    onOpenChange(isOpen)
  }

  const typeLabels = {
    "schema": "Collection Type",
    "single-type": "Single Type",
    "component": "Component",
    "system": "System Architecture"
  }

  const apiEndpoints = {
    "schema": tenantSlug ? `/api/tenant/${tenantSlug}/ai/generate-schema` : `/api/admin/ai/generate-schema`,
    "single-type": tenantSlug ? `/api/tenant/${tenantSlug}/ai/generate-single-type` : `/api/admin/ai/generate-single-type`,
    "component": tenantSlug ? `/api/tenant/${tenantSlug}/ai/generate-component` : `/api/admin/ai/generate-component`,
    "system": `/api/admin/ai/generate-system`
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
          description: `${typeLabels[type]} "${data.name}" has been generated.`,
          className: "bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-none shadow-none"
        })
        
        setGeneratedData(data)
        
        if (onSuccess) {
          onSuccess()
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

  const handleContinue = () => {
    handleOpenChange(false)
    const pathMap = {
      "schema": "content-types",
      "single-type": "single-types",
      "component": "components"
    }
    const basePath = tenantSlug ? `/dashboard/${tenantSlug}` : `/admin`
    
    if (type === "system") {
      router.push(`/admin/entries/templates`)
    } else {
      router.push(`${basePath}/${pathMap[type]}/edit/${generatedData.slug}`)
    }
  }

  const currentTemplates = aiTemplates[type] || []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-border shadow-none rounded-none max-h-[90vh] flex flex-col bg-card">
        <div className="bg-muted p-8 border-b border-border text-foreground shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-none bg-muted border border-border flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">AI {typeLabels[type]} Generator</DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                Describe what you want to build, and AI will architect the schema for you.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-card overflow-y-auto flex-1">
          {loading ? (
             <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
               <Loader2 className="h-14 w-14 animate-spin text-orange-500" />
               <div>
                 <p className="font-black text-xl text-foreground">Architecting Schema...</p>
                 <p className="text-muted-foreground text-sm font-medium mt-1">AI is analyzing your prompt and structuring the fields.</p>
               </div>
             </div>
          ) : generatedData ? (
             <div className="space-y-6">
               <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-none text-center">
                 <Sparkles className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
                 <h3 className="text-xl font-black text-emerald-800 tracking-tight">Generation Complete!</h3>
                 <p className="text-emerald-700 text-sm mt-1 font-medium">Your new {typeLabels[type]} has been successfully architected.</p>
               </div>
               
               <div className="space-y-4 border border-border p-6 bg-muted/20 rounded-none">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">Name</p>
                      <p className="font-bold text-foreground text-base">
                        {type === "system" ? generatedData.data.name : generatedData.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">API Slug / ID</p>
                      <code className="text-sm font-bold bg-muted px-2 py-1 text-primary border border-border">
                        /{type === "system" ? generatedData.data.template_id : generatedData.slug}
                      </code>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-border">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                        {type === "system" ? "Generated Elements" : "Generated Fields"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {type === "system" ? (
                          <>
                            <Badge variant="outline" className="bg-background text-xs font-bold rounded-none">
                              {generatedData.data.schema_template.contentTypes?.length || 0} Content Types
                            </Badge>
                            <Badge variant="outline" className="bg-background text-xs font-bold rounded-none">
                              {generatedData.data.schema_template.singleTypes?.length || 0} Single Types
                            </Badge>
                            <Badge variant="outline" className="bg-background text-xs font-bold rounded-none">
                              {generatedData.data.schema_template.components?.length || 0} Components
                            </Badge>
                          </>
                        ) : (
                          generatedData.fields?.map((f: any) => (
                            <Badge key={f.slug} variant="outline" className="bg-background text-xs font-bold rounded-none">
                              {f.name} <span className="opacity-50 ml-1 font-mono text-[9px] uppercase">{f.type}</span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
               </div>
             </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Quick Start Templates
                </Label>
                <div className="flex flex-wrap gap-2">
                  {currentTemplates.map((t) => (
                    <Button
                      key={t.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setPrompt(t.prompt)}
                      className="rounded-none text-[10px] font-bold uppercase tracking-tight h-8 border border-border hover:border-orange-500 hover:bg-muted transition-colors"
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Custom Prompt / Description
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
                  className="min-h-[150px] bg-muted/30 border border-border rounded-none p-5 text-sm font-medium focus-visible:ring-orange-500"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-none bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900 flex gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          {!loading && !generatedData && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-none bg-muted/50 border border-border">
                <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-1">Architecture</p>
                <p className="text-[11px] text-muted-foreground leading-tight">AI will auto-generate fields, slugs, and data types.</p>
              </div>
              <div className="p-4 rounded-none bg-muted/50 border border-border">
                <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-1">Time Saver</p>
                <p className="text-[11px] text-muted-foreground leading-tight">Generate complex structures in under 10 seconds.</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-8 bg-muted/10 border-t border-border gap-3 shrink-0">
          <Button 
            variant="ghost" 
            onClick={() => handleOpenChange(false)}
            className="rounded-none font-bold px-6 h-12 border border-border hover:bg-muted transition-colors"
            disabled={loading}
          >
            {generatedData ? "Close" : "Cancel"}
          </Button>
          
          {generatedData ? (
            <Button 
              onClick={handleContinue}
              className="flex-1 rounded-none bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 font-black uppercase tracking-widest h-12 transition-colors"
            >
              Review in Editor
            </Button>
          ) : (
            <Button 
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className="flex-1 rounded-none bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white border border-zinc-900 dark:border-zinc-100 font-black uppercase tracking-widest h-12 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-5 w-5" />
                  Generate {typeLabels[type]}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
