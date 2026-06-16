"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Play, Copy, Check, Send, Globe, Database, 
  Terminal, Code2, Zap, Key, Loader2, RefreshCw,
  Info, Link as LinkIcon, FileDown, Sparkles
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { JsonViewer } from "@/components/ui/json-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface ApiKey { id: string; name: string; token: string }
interface ContentType { id: string; name: string; slug: string; fields?: any[] }
interface SingleType { id: string; name: string; slug: string; fields?: any[] }

export default function ApiExplorerPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [method, setMethod] = useState("GET")
  const [endpoint, setEndpoint] = useState("")
  const [requestBody, setRequestBody] = useState('{\n  "data": {}\n}')

  useEffect(() => {
    if (tenantSlug) setEndpoint(`/api/v1/${tenantSlug}/content`)
  }, [tenantSlug])
  
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [selectedKey, setSelectedKey] = useState("")
  const [exporting, setExporting] = useState(false)
  const [exportingPrompt, setExportingPrompt] = useState(false)
  const [copied, setCopied] = useState(false)


  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!tenantSlug || status !== "authenticated") return
      try {
        const [ctRes, stRes, akRes] = await Promise.all([
          fetch(`/api/tenant/${tenantSlug}/content-types`),
          fetch(`/api/tenant/${tenantSlug}/single-types`),
          fetch(`/api/tenant/${tenantSlug}/api-tokens`)
        ])
        if (ctRes.ok) setContentTypes(await ctRes.json() || [])
        if (stRes.ok) setSingleTypes(await stRes.json() || [])
        if (akRes.ok) {
          const akData = await akRes.json()
          const tokens = akData.tokens || []
          setApiKeys(tokens)
          if (tokens.length > 0 && !selectedKey) {
            const firstToken = tokens[0].token
            if (firstToken && !firstToken.includes("*")) setSelectedKey(firstToken)
          }
        }
      } catch (err) { console.error("Error fetching data", err) }
    }
    fetchData()
  }, [tenantSlug, status])

  const handleDownloadOpenApi = async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/developer/openapi`)
      if (!res.ok) throw new Error("Failed to export OpenAPI")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${tenantSlug}-openapi.yaml`; document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
      toast({ title: "OpenAPI Exported Successfully" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message })
    } finally { setExporting(false) }
  }

  const handleDownloadAiPrompt = async () => {
    setExportingPrompt(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/developer/ai-prompt`)
      if (!res.ok) throw new Error("Failed to generate AI prompt")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${tenantSlug}-ai-prompt.md`; document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
      toast({ title: "AI Prompt Downloaded" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download Failed", description: err.message })
    } finally { setExportingPrompt(false) }
  }

  const generateDummyDataForSlug = (cleanSlug: string, type: string) => {
    let dummyData: Record<string, any> = {}
    const targetFields = type === 'content' 
      ? contentTypes.find((c: any) => c.slug === cleanSlug)?.fields 
      : singleTypes.find((s: any) => s.slug === cleanSlug)?.fields
      
    if (targetFields) {
      targetFields.forEach((f: any) => {
        if (f.type === 'string' || f.type === 'text' || f.type === 'richtext') dummyData[f.slug] = "string value"
        else if (f.type === 'number') dummyData[f.slug] = 123
        else if (f.type === 'boolean') dummyData[f.slug] = true
        else if (f.type === 'date') dummyData[f.slug] = new Date().toISOString()
        else if (f.type === 'relation') dummyData[f.slug] = "relation_id"
        else if (f.type === 'media') dummyData[f.slug] = "media_id"
        else if (f.type === 'json') dummyData[f.slug] = {}
        else dummyData[f.slug] = null
      })
      return dummyData
    }
    return null
  }

  const handleQuickSelect = (value: string) => {
    const [m, type, slugPath] = value.split('|')
    setMethod(m)
    
    if (type === 'content') setEndpoint(`/api/v1/${tenantSlug}/content/${slugPath}`)
    else if (type === 'single') setEndpoint(`/api/v1/${tenantSlug}/single/${slugPath}`)

    if (m === 'POST' || m === 'PATCH') {
      const cleanSlug = slugPath.split('/')[0]
      const dummyData = generateDummyDataForSlug(cleanSlug, type)
      if (dummyData) {
        setRequestBody(JSON.stringify({ data: dummyData }, null, 2))
      } else {
        setRequestBody('{\n  "data": {}\n}')
      }
    } else {
      setRequestBody('{\n  "data": {}\n}')
    }
  }

  const handleMethodChange = (m: string) => {
    setMethod(m)
    if (m === 'POST' || m === 'PATCH') {
      const parts = endpoint.split('/')
      const contentIndex = parts.indexOf('content')
      const singleIndex = parts.indexOf('single')
      
      let cleanSlug = ''
      let type = ''
      
      if (contentIndex !== -1 && parts.length > contentIndex + 1) {
        cleanSlug = parts[contentIndex + 1].split('/')[0]
        type = 'content'
      } else if (singleIndex !== -1 && parts.length > singleIndex + 1) {
        cleanSlug = parts[singleIndex + 1].split('/')[0]
        type = 'single'
      }
      
      if (cleanSlug) {
        const dummyData = generateDummyDataForSlug(cleanSlug, type)
        if (dummyData) {
          setRequestBody(JSON.stringify({ data: dummyData }, null, 2))
        }
      }
    } else {
      setRequestBody('{\n  "data": {}\n}')
    }
  }

  const handleSendRequest = async () => {
    if (!selectedKey) {
      toast({ variant: "destructive", title: "Authentication Required", description: "Please select or enter an API Key to test the public endpoints." })
      return
    }
    setLoading(true); setResponse(null)
    try {
      const url = endpoint
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (selectedKey) headers["Authorization"] = `Bearer ${selectedKey}`
      const options: RequestInit = { method, headers }
      
      if (method !== "GET" && method !== "DELETE") options.body = requestBody

      const res = await fetch(url, options)
      const data = await res.json()
      setResponse(data)
      if (res.ok) toast({ title: "Request Successful" })
      else toast({ variant: "destructive", title: `Error ${res.status}`, description: data.error || "Request failed" })
    } catch (error: any) {
      setResponse({ error: error.message || "Failed to connect to server" })
      toast({ variant: "destructive", title: "Connection Error" })
    } finally { setLoading(false) }
  }

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center bg-background text-foreground flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  return (
    <div className="flex bg-background text-foreground selection:bg-orange-500/30 font-sans flex-1 flex-col w-full">
<div className="flex-1 relative flex-col w-full">
        {/* Ambient Glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-500/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="p-6 lg:p-10 w-full space-y-8 relative z-10">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-border/50">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-semibold uppercase tracking-widest shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                <Sparkles className="w-3.5 h-3.5" />
                Developer API
              </div>
              <h1 className="text-4xl font-light tracking-tight">API Explorer</h1>
              <p className="text-muted-foreground text-sm max-w-xl leading-relaxed">
                Test your headless REST endpoints in real-time. Discover schema structure through OpenAPI and generate AI integrations instantly.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-card/80 border border-border/50 rounded-none p-1 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-2 px-3 border-r border-border/50">
                  <Key className="w-4 h-4 text-orange-500" />
                  <span className="text-xs font-medium text-muted-foreground">Auth Token</span>
                </div>
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                  <SelectTrigger className="h-8 min-w-[200px] border-none bg-transparent focus:ring-0 text-xs font-mono rounded-none">
                    <SelectValue placeholder="Select API Key..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-border bg-popover/95 backdrop-blur-xl">
                    {apiKeys.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">No keys found</div>}
                    {apiKeys.map(key => (
                      <SelectItem key={key.id} value={key.token} className="text-xs font-mono rounded-none focus:bg-accent focus:text-accent-foreground">
                        {key.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                variant="outline" 
                className="h-10 bg-card/80 border-border/50 hover:bg-orange-500/10 hover:text-orange-600 dark:hover:text-orange-400 hover:border-orange-500/30 transition-all duration-300 rounded-none text-xs backdrop-blur-md shadow-sm"
                onClick={handleDownloadAiPrompt}
                disabled={exportingPrompt}
              >
                {exportingPrompt ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                AI Prompt
              </Button>
              <Button 
                variant="outline" 
                className="h-10 bg-card/80 border-border/50 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 transition-all duration-300 rounded-none text-xs backdrop-blur-md shadow-sm"
                onClick={handleDownloadOpenApi}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                OpenAPI Spec
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            {/* Left Panel: Request Builder */}
            <div className="xl:col-span-6 flex flex-col gap-6">
              
              <div className="bg-card/40 border border-border/50 rounded-none p-6 backdrop-blur-xl relative group transition-all duration-500 hover:border-border shadow-lg flex-1">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                <div className="space-y-6 relative z-10">
                  <div className="flex flex-col gap-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Path Generator</Label>
                    <Select onValueChange={handleQuickSelect}>
                      <SelectTrigger className="h-12 bg-background/50 border-border/50 rounded-none text-sm focus:ring-orange-500/50 transition-all">
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-orange-500" />
                          <SelectValue placeholder="Select an auto-generated endpoint..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-border bg-popover/95 backdrop-blur-xl">
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-3">Collection Types</SelectLabel>
                          
                          {method === 'GET' && contentTypes.map(ct => (
                            <SelectItem key={`get-${ct.id}`} value={`GET|content|${ct.slug}`} className="rounded-none focus:bg-accent">
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-2 w-12 inline-block">GET</span> List {ct.name}
                            </SelectItem>
                          ))}
                          
                          {method === 'POST' && contentTypes.map(ct => (
                            <SelectItem key={`post-${ct.id}`} value={`POST|content|${ct.slug}`} className="rounded-none focus:bg-accent">
                              <span className="font-semibold text-blue-600 dark:text-blue-400 mr-2 w-12 inline-block">POST</span> Create {ct.name}
                            </SelectItem>
                          ))}

                          {method === 'PATCH' && contentTypes.map(ct => (
                            <SelectItem key={`patch-${ct.id}`} value={`PATCH|content|${ct.slug}/[id]`} className="rounded-none focus:bg-accent">
                              <span className="font-semibold text-orange-600 dark:text-orange-400 mr-2 w-12 inline-block">PATCH</span> Update {ct.name}
                            </SelectItem>
                          ))}

                          {method === 'DELETE' && contentTypes.map(ct => (
                            <SelectItem key={`delete-${ct.id}`} value={`DELETE|content|${ct.slug}/[id]`} className="rounded-none focus:bg-accent">
                              <span className="font-semibold text-red-600 dark:text-red-400 mr-2 w-12 inline-block">DELETE</span> Remove {ct.name}
                            </SelectItem>
                          ))}

                          {contentTypes.length === 0 && (
                            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">No collections found.</div>
                          )}
                        </SelectGroup>
                        
                        {(method === 'GET' || method === 'PATCH') && (
                          <SelectGroup className="mt-2 pt-2 border-t border-border/50">
                            <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider px-3">Single Types</SelectLabel>
                            
                            {method === 'GET' && singleTypes.map(st => (
                              <SelectItem key={`get-st-${st.id}`} value={`GET|single|${st.slug}`} className="rounded-none focus:bg-accent">
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-2 w-12 inline-block">GET</span> Read {st.name}
                              </SelectItem>
                            ))}
                            
                            {method === 'PATCH' && singleTypes.map(st => (
                              <SelectItem key={`patch-st-${st.id}`} value={`PATCH|single|${st.slug}`} className="rounded-none focus:bg-accent">
                                <span className="font-semibold text-orange-600 dark:text-orange-400 mr-2 w-12 inline-block">PATCH</span> Update {st.name}
                              </SelectItem>
                            ))}

                            {singleTypes.length === 0 && (
                              <div className="px-3 py-2 text-[11px] text-muted-foreground italic">No single types found.</div>
                            )}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Request URL</Label>
                    <div className="flex shadow-sm">
                      <Select value={method} onValueChange={handleMethodChange}>
                        <SelectTrigger className="w-[120px] h-12 bg-muted/30 border border-r-0 border-border/50 rounded-none text-sm font-semibold focus:ring-0 focus:border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border-border bg-popover/95 backdrop-blur-xl">
                          <SelectItem value="GET" className="text-emerald-600 dark:text-emerald-400 rounded-none focus:bg-accent">GET</SelectItem>
                          <SelectItem value="POST" className="text-blue-600 dark:text-blue-400 rounded-none focus:bg-accent">POST</SelectItem>
                          <SelectItem value="PATCH" className="text-orange-600 dark:text-orange-400 rounded-none focus:bg-accent">PATCH</SelectItem>
                          <SelectItem value="DELETE" className="text-red-600 dark:text-red-400 rounded-none focus:bg-accent">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        value={endpoint} 
                        onChange={e => setEndpoint(e.target.value)}
                        className="flex-1 h-12 bg-background/50 border border-border/50 rounded-none font-mono text-sm focus-visible:ring-1 focus-visible:ring-orange-500/50 transition-all"
                        placeholder="/api/v1/..."
                      />
                    </div>
                  </div>

                  {(method === "POST" || method === "PATCH") && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">JSON Payload</Label>
                      <Textarea 
                        value={requestBody} 
                        onChange={e => setRequestBody(e.target.value)}
                        className="min-h-[220px] font-mono text-sm bg-muted/20 border border-border/50 rounded-none p-4 focus-visible:ring-1 focus-visible:ring-orange-500/50 text-orange-600 dark:text-orange-200/90 shadow-inner"
                      />
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <Button 
                      className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm tracking-wide rounded-none transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.15)] hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] border border-orange-400/50"
                      onClick={handleSendRequest}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" /> SEND REQUEST
                        </span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Helper Card */}
              <div className="p-5 bg-card/40 border border-border/50 rounded-none flex gap-4 backdrop-blur-md">
                <div className="mt-0.5">
                  <Info className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Pro Tip</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Use the <strong>Quick Path Generator</strong> above to automatically build endpoints for your collections. It saves time and ensures correct formatting.
                  </p>
                </div>
              </div>

              {/* Query Parameters Documentation */}
              <div className="bg-card/40 border border-border/50 rounded-none p-6 backdrop-blur-xl shadow-lg flex-1 overflow-hidden">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                  <Database className="h-4 w-4 text-orange-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Query Parameters Reference</h3>
                </div>
                
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-6">
                    {/* Filtering */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-widest">Filters</h4>
                      <p className="text-xs text-muted-foreground">Filter your results using Strapi-like syntax. Format: <code className="text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded">?filters[field][$operator]=value</code></p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2">
                        <div className="bg-background/50 p-2 border border-border/30">$eq, $ne</div>
                        <div className="bg-background/50 p-2 border border-border/30 text-muted-foreground">Equal, Not equal</div>
                        
                        <div className="bg-background/50 p-2 border border-border/30">$gt, $gte, $lt, $lte</div>
                        <div className="bg-background/50 p-2 border border-border/30 text-muted-foreground">Greater/Less than</div>
                        
                        <div className="bg-background/50 p-2 border border-border/30">$contains, $startsWith</div>
                        <div className="bg-background/50 p-2 border border-border/30 text-muted-foreground">Text matching (ILIKE)</div>
                        
                        <div className="bg-background/50 p-2 border border-border/30">$in, $notIn</div>
                        <div className="bg-background/50 p-2 border border-border/30 text-muted-foreground">Array inclusion (comma separated)</div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 italic">Example: ?filters[title][$contains]=hello&filters[price][$gte]=100</p>
                    </div>

                    {/* Sorting */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-widest">Sort</h4>
                      <p className="text-xs text-muted-foreground">Sort the response by a specific field.</p>
                      <code className="block text-xs text-orange-400 bg-orange-500/10 p-2 border border-border/30 mt-1">?sort=createdAt:desc</code>
                    </div>

                    {/* Populate */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-widest">Populate</h4>
                      <p className="text-xs text-muted-foreground">Expand relational fields in the response.</p>
                      <code className="block text-xs text-orange-400 bg-orange-500/10 p-2 border border-border/30 mt-1">?populate=* (All) or ?populate=author,category</code>
                    </div>

                    {/* Field Selection */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-orange-500 uppercase tracking-widest">Fields</h4>
                      <p className="text-xs text-muted-foreground">Select only specific fields to return.</p>
                      <code className="block text-xs text-orange-400 bg-orange-500/10 p-2 border border-border/30 mt-1">?fields=title,slug</code>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Right Panel: Response */}
            <div className="xl:col-span-6 flex flex-col gap-6">
              <div className="bg-card/40 border border-border/50 rounded-none flex-1 min-h-[500px] flex flex-col overflow-hidden backdrop-blur-xl shadow-lg relative group transition-all duration-500 hover:border-border">
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                
                <div className="bg-muted/30 border-b border-border/50 py-3 px-5 flex items-center justify-between z-10">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-orange-500" /> Server Response
                  </h3>
                  {response && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-[10px] font-semibold uppercase tracking-wider rounded-none hover:bg-accent hover:text-foreground px-3 transition-colors" 
                      onClick={handleCopyResponse}
                    >
                      {copied ? <Check className="h-3 w-3 mr-1.5 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1.5 text-muted-foreground" />}
                      {copied ? "Copied" : "Copy JSON"}
                    </Button>
                  )}
                </div>
                
                <div className="p-0 flex-1 relative bg-background/50 z-10">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-20 transition-all duration-300">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                          <div className="absolute inset-0 bg-orange-500 blur-xl opacity-20 rounded-full" />
                          <RefreshCw className="h-8 w-8 animate-spin text-orange-500 relative z-10" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Awaiting Response...</p>
                      </div>
                    </div>
                  ) : null}
                  
                  {response ? (
                    <div className="p-5 h-full overflow-auto">
                      <JsonViewer 
                        data={response} 
                        className="h-full max-h-[800px] bg-transparent border-none p-0 text-[13px] font-mono leading-relaxed" 
                      />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-32 opacity-40">
                      <Globe className="h-16 w-16 mb-5 text-orange-500/50" strokeWidth={1} />
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Ready for requests</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
