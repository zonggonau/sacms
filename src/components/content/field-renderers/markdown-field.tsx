"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Edit3 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownFieldProps {
  value: string
  onChange: (value: string) => void
  label?: string | React.ReactNode
  placeholder?: string
  required?: boolean
  error?: string
}

export function MarkdownField({
  value,
  onChange,
  label,
  placeholder = "Write markdown here...",
  required = false,
  error,
}: MarkdownFieldProps) {
  const [activeTab, setActiveTab] = useState("write")

  return (
    <div className="space-y-2">
      {label && (
        typeof label === "string" ? (
          <Label className={cn(error ? "text-destructive" : "")}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
        ) : label
      )}
      <div className={cn(
        "border border-border/80 rounded-xl overflow-hidden bg-card shadow-xs focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all",
        error ? "border-destructive focus-within:ring-destructive focus-within:border-destructive" : ""
      )}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="bg-muted/30 border-b border-border/60 flex items-center justify-between px-2 py-1">
            <TabsList className="h-8 bg-transparent p-0">
              <TabsTrigger 
                value="write" 
                className="rounded-lg h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer font-bold"
              >
                <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                Tulis
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                className="rounded-lg h-7 px-3 text-xs data-[state=active]:bg-background data-[state=active]:shadow-xs cursor-pointer font-bold"
              >
                <Eye className="h-3.5 w-3.5 mr-1.5" />
                Pratinjau
              </TabsTrigger>
            </TabsList>
            <div className="text-[10px] text-muted-foreground font-mono px-2">
              Markdown supported
            </div>
          </div>
          
          <TabsContent value="write" className="p-0 m-0 border-none outline-none">
            <Textarea
              value={value || ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="min-h-[200px] border-none shadow-none focus-visible:ring-0 rounded-none resize-y font-mono text-sm bg-transparent"
            />
          </TabsContent>
          
          <TabsContent value="preview" className="p-0 m-0 border-none outline-none">
            <div className="min-h-[200px] p-4 prose prose-sm dark:prose-invert max-w-none bg-background/50">
              {value ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {value}
                </ReactMarkdown>
              ) : (
                <div className="text-muted-foreground italic text-sm">
                  Nothing to preview
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
