"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, Terminal } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ApiPageClientProps {
  initialData: any
  apiUrl: string
}

export function ApiPageClient({ initialData, apiUrl }: ApiPageClientProps) {
  const { toast } = useToast()
  
  const handleCopy = (text: string, entity: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied!",
      description: `${entity} has been copied to clipboard.`
    })
  }

  const promptText = `Act as an expert Next.js & React Frontend Developer.
I have a Headless CMS backend that returns all global website content via a single REST endpoint. 
Please create a modern, responsive landing page using Next.js 14+ (App Router), TailwindCSS, and shadcn/ui.

**Live API Endpoint:**
GET ${apiUrl}

Here is the JSON data currently returned from the API endpoint:
\`\`\`json
${JSON.stringify(initialData, null, 2)}
\`\`\`

Requirements:
1. Fetch live data from the API endpoint using standard Next.js fetch() in server components.
2. Map the 'singleTypes' data to corresponding sections (e.g., Hero, About, Footer).
3. Map the 'collections' data to list sections (e.g., Features, Testimonials).
4. Ensure the UI is highly polished with micro-animations (framer-motion is optional but welcome).
5. Provide the full page.tsx code.`

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">API & Integration</h1>
        <p className="text-muted-foreground mt-2">
          Access all global content via public REST API. Useful for building your frontend application.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Global Content Endpoint</CardTitle>
          <CardDescription>GET request to fetch all global single types and collections.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
            <span className="text-orange-500 font-bold">GET</span>
            <span className="flex-1">{apiUrl}</span>
            <Button variant="ghost" size="icon" onClick={() => handleCopy(apiUrl, "API URL")}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>JSON Response Data</CardTitle>
              <CardDescription>Current snapshot of your global content data.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleCopy(JSON.stringify(initialData, null, 2), "JSON Data")}>
              <Copy className="h-4 w-4 mr-2" /> Copy JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full rounded-md border bg-muted p-4">
            <pre className="text-xs font-mono">
              {JSON.stringify(initialData, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-orange-500/20 bg-orange-500/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-orange-500" />
              <div>
                <CardTitle>AI Frontend Prompt</CardTitle>
                <CardDescription>Copy this prompt into ChatGPT, Claude, or Gemini to instantly generate your frontend.</CardDescription>
              </div>
            </div>
            <Button onClick={() => handleCopy(promptText, "AI Prompt")}>
              <Copy className="h-4 w-4 mr-2" /> Copy Prompt
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border bg-background p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {promptText}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
