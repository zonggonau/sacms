"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Play, Copy, Check, Send, Globe, Database, 
  Terminal, Code2, Zap, Key, Loader2, RefreshCw,
  Search, Info, Link as LinkIcon, ChevronRight,
  FileDown
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
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { JsonViewer } from "@/components/ui/json-viewer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"

interface ApiKey {
  id: string
  name: string
  token: string
}

interface ContentType {
  id: string
  name: string
  slug: string
}

interface SingleType {
  id: string
  name: string
  slug: string
}

export default function ApiExplorerPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [activeProtocol, setActiveProtocol] = useState<"rest" | "graphql">("rest")
  const [method, setMethod] = useState("GET")
  const [endpoint, setEndpoint] = useState("")
  const [requestBody, setRequestBody] = useState('{\n  "data": {}\n}')
  const [gqlQuery, setGqlQuery] = useState('query {\n  # Start typing your query...\n}')

  useEffect(() => {
    if (tenantSlug) {
      setEndpoint(`/api/public/${tenantSlug}/content`)
    }
  }, [tenantSlug])
  
  const [response, setResponse] = useState<any>(null)
  const [gqlSchemaInfo, setGqlSchemaInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [loadingSchema, setLoadingSchema] = useState(false)

  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [selectedKey, setSelectedKey] = useState("")
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const tenants = (session?.user as any)?.tenants || []

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
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
        
        if (ctRes.ok) {
          const ctData = await ctRes.json()
          setContentTypes(ctData || [])
        }
        
        if (stRes.ok) {
          const stData = await stRes.json()
          setSingleTypes(stData || [])
        }
        
        if (akRes.ok) {
          const akData = await akRes.json()
          const tokens = akData.tokens || []
          setApiKeys(tokens)
          // Don't auto-set masked tokens
          if (tokens.length > 0 && !selectedKey) {
            const firstToken = tokens[0].token
            if (firstToken && !firstToken.includes("*")) {
              setSelectedKey(firstToken)
            }
          }
        }
      } catch (err) {
        console.error("Error fetching data", err)
      }
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
      a.href = url
      a.download = `${tenantSlug}-openapi.yaml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({ title: "OpenAPI Exported Successfully" })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Export Failed", description: err.message })
    } finally {
      setExporting(false)
    }
  }

  const fetchGqlSchema = async () => {
    if (!selectedKey || activeProtocol !== "graphql") return
    setLoadingSchema(true)
    try {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            types {
              name
              kind
              fields {
                name
                type {
                  name
                  kind
                  ofType { name kind }
                }
              }
            }
          }
        }
      `
      const res = await fetch(`/api/public/${tenantSlug}/graphql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${selectedKey}`
        },
        body: JSON.stringify({ query: introspectionQuery })
      })
      if (res.ok) {
        const data = await res.json()
        setGqlSchemaInfo(data.data?.__schema)
      }
    } catch (err) {
      console.error("Failed to fetch GQL schema", err)
    } finally {
      setLoadingSchema(false)
    }
  }

  useEffect(() => {
    if (activeProtocol === "graphql" && selectedKey) {
      fetchGqlSchema()
    }
  }, [activeProtocol, selectedKey])

  const handleQuickSelect = (value: string) => {
    const [m, type, slug] = value.split('|')
    setMethod(m)
    if (type === 'content') {
      setEndpoint(`/api/public/${tenantSlug}/content/${slug}`)
    } else if (type === 'single') {
      setEndpoint(`/api/public/${tenantSlug}/single/${slug}`)
    }
  }

  const handleSendRequest = async () => {
    if (!selectedKey) {
      toast({
        variant: "destructive",
        title: "Authentication Required",
        description: "Please select or enter an API Key to test the public endpoints."
      })
      return
    }
    
    setLoading(true)
    setResponse(null)
    
    try {
      const isGql = activeProtocol === "graphql"
      const url = isGql ? `/api/public/${tenantSlug}/graphql` : endpoint
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      
      if (selectedKey) {
        headers["Authorization"] = `Bearer ${selectedKey}`
      }

      const options: RequestInit = {
        method: isGql ? "POST" : method,
        headers,
      }

      if (isGql) {
        options.body = JSON.stringify({ query: gqlQuery })
      } else if (method !== "GET" && method !== "DELETE") {
        options.body = requestBody
      }

      const res = await fetch(url, options)
      const data = await res.json()
      setResponse(data)
      
      if (res.ok) {
        toast({ title: "Request Successful" })
      } else {
        toast({ variant: "destructive", title: `Error ${res.status}`, description: data.error || "Request failed" })
      }
    } catch (error: any) {
      setResponse({ error: error.message || "Failed to connect to server" })
      toast({ variant: "destructive", title: "Connection Error" })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-muted/10">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">API Explorer</h1>
              <p className="text-muted-foreground">Automated endpoint testing for your content schemas.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                className="bg-card font-bold border-emerald-100 text-emerald-700 hover:bg-emerald-50 h-11"
                onClick={handleDownloadOpenApi}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                Export OpenAPI
              </Button>
              <div className="flex items-center gap-3 bg-card p-2 px-4 rounded-2xl border shadow-sm h-11">
                <Key className="h-4 w-4 text-amber-500" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-muted-foreground leading-none mb-1">Active Auth Token</span>
                  <div className="flex items-center gap-2">
                    <Select value={selectedKey} onValueChange={setSelectedKey}>
                      <SelectTrigger className="h-6 min-w-[200px] text-[10px] font-mono border-none bg-muted/50 focus-visible:ring-0 p-0 px-2">
                        <SelectValue placeholder="Select API Key..." />
                      </SelectTrigger>
                      <SelectContent>
                        {apiKeys.length === 0 && (
                          <div className="p-2 text-[10px] text-muted-foreground text-center">
                            No API Keys found
                          </div>
                        )}
                        {apiKeys.map(key => (
                          <SelectItem key={key.id} value={key.token} className="text-[10px] font-mono">
                            <span className="font-bold">{key.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            
            {/* Left: Request Panel */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="border-none shadow-sm bg-card overflow-hidden">
                <CardHeader className="bg-muted/20 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" /> 
                      <CardTitle className="text-lg font-bold">Request Builder</CardTitle>
                    </div>
                    <Tabs value={activeProtocol} onValueChange={(v) => setActiveProtocol(v as any)} className="w-auto">
                      <TabsList className="h-8 p-1 bg-background rounded-lg">
                        <TabsTrigger value="rest" className="text-xs h-6 px-3 rounded-md">REST</TabsTrigger>
                        <TabsTrigger value="graphql" className="text-xs h-6 px-3 rounded-md">GraphQL</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {activeProtocol === "rest" ? (
                    <div className="space-y-4">
                      {/* Endpoint Quick Selection */}
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Quick Path Generator</Label>
                        <Select onValueChange={handleQuickSelect}>
                          <SelectTrigger className="h-11 bg-primary/5 border-primary/20 hover:bg-primary/10 transition-colors rounded-xl font-bold text-primary">
                            <div className="flex items-center gap-2">
                              <LinkIcon className="h-4 w-4" />
                              <SelectValue placeholder="Select an auto-generated endpoint..." />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel className="text-[10px] uppercase font-black opacity-50">Collection Types</SelectLabel>
                              {contentTypes.map(ct => (
                                <SelectItem key={`get-${ct.id}`} value={`GET|content|${ct.slug}`}>
                                  <span className="font-bold text-emerald-600 mr-2">GET</span> List all {ct.name}
                                </SelectItem>
                              ))}
                              {contentTypes.map(ct => (
                                <SelectItem key={`post-${ct.id}`} value={`POST|content|${ct.slug}`}>
                                  <span className="font-bold text-blue-600 mr-2">POST</span> Create {ct.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                            <SelectGroup className="mt-2 pt-2 border-t">
                              <SelectLabel className="text-[10px] uppercase font-black opacity-50">Single Types</SelectLabel>
                              {singleTypes.map(st => (
                                <SelectItem key={`get-st-${st.id}`} value={`GET|single|${st.slug}`}>
                                  <span className="font-bold text-emerald-600 mr-2">GET</span> Read {st.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex gap-2">
                        <Select value={method} onValueChange={setMethod}>
                          <SelectTrigger className="w-[120px] h-11 bg-muted/30 border-none font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GET" className="text-emerald-600 font-bold">GET</SelectItem>
                            <SelectItem value="POST" className="text-blue-600 font-bold">POST</SelectItem>
                            <SelectItem value="PATCH" className="text-orange-600 font-bold">PATCH</SelectItem>
                            <SelectItem value="DELETE" className="text-red-600 font-bold">DELETE</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                          <Input 
                            value={endpoint} 
                            onChange={e => setEndpoint(e.target.value)}
                            className="h-11 pl-10 bg-muted/30 border-none font-mono text-xs"
                          />
                        </div>
                        <Button 
                          className="h-11 px-6 bg-primary font-bold shadow-lg shadow-primary/20" 
                          onClick={handleSendRequest}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                          SEND
                        </Button>
                      </div>

                      {(method === "POST" || method === "PATCH") && (
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">JSON Payload</Label>
                          <Textarea 
                            value={requestBody} 
                            onChange={e => setRequestBody(e.target.value)}
                            className="min-h-[200px] font-mono text-xs bg-muted/30 border-none rounded-xl"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                            <Code2 className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold">GraphQL Endpoint</p>
                            <p className="text-[10px] text-muted-foreground font-mono">/api/public/{tenantSlug}/graphql</p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          className="bg-primary font-bold shadow-md shadow-primary/20"
                          onClick={handleSendRequest}
                          disabled={loading}
                        >
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3 mr-1.5" />}
                          Run Query
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Query Editor</Label>
                        <Textarea 
                          value={gqlQuery} 
                          onChange={e => setGqlQuery(e.target.value)}
                          className="min-h-[300px] font-mono text-xs bg-zinc-900 text-emerald-400 border-none rounded-xl p-4 focus-visible:ring-emerald-500 shadow-inner"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Helper Card */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-800 shadow-sm">
                <Info className="h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs font-black uppercase tracking-widest">Efficiency Tip</p>
                  <p className="text-[11px] leading-relaxed opacity-80">
                    Use the <strong>Quick Path Generator</strong> above to automatically build endpoints for your collections. 
                    It saves time and ensures correct URL formatting.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Response & Schema Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* GraphQL Schema Explorer (Only shown for GQL) */}
              {activeProtocol === "graphql" && (
                <Card className="border-none shadow-sm bg-card overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Database className="h-3 w-3" /> Schema Explorer
                      </CardTitle>
                      {loadingSchema && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="h-[300px]">
                      {!selectedKey ? (
                        <div className="p-8 text-center opacity-40">
                          <Key className="h-8 w-8 mx-auto mb-2" />
                          <p className="text-[10px] font-bold uppercase">Enter API Key to load schema</p>
                        </div>
                      ) : !gqlSchemaInfo ? (
                        <div className="p-8 text-center opacity-40">
                          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin" />
                          <p className="text-[10px] font-bold uppercase">Fetching Schema...</p>
                        </div>
                      ) : (
                        <div className="p-4 space-y-4">
                          {/* Queries */}
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest bg-emerald-50 px-2 py-1 rounded w-fit">Available Queries</p>
                            <div className="space-y-1.5 pl-1">
                              {gqlSchemaInfo.types.find((t: any) => t.name === gqlSchemaInfo.queryType.name)?.fields.map((f: any) => (
                                <div key={f.name} className="flex items-center gap-2 group">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  <span className="text-xs font-mono font-bold text-foreground">{f.name}</span>
                                  <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                    : {f.type.name || f.type.ofType?.name || 'Object'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Mutations */}
                          {gqlSchemaInfo.mutationType && (
                            <div className="space-y-2">
                              <p className="text-[9px] font-black uppercase text-blue-600 tracking-widest bg-blue-50 px-2 py-1 rounded w-fit">Available Mutations</p>
                              <div className="space-y-1.5 pl-1">
                                {gqlSchemaInfo.types.find((t: any) => t.name === gqlSchemaInfo.mutationType.name)?.fields.map((f: any) => (
                                  <div key={f.name} className="flex items-center gap-2 group">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                    <span className="text-xs font-mono font-bold text-foreground">{f.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <Card className="border-none shadow-sm bg-card flex-1 min-h-[400px] flex flex-col overflow-hidden">
                <CardHeader className="bg-muted/20 border-b flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-muted-foreground" /> Server Response
                  </CardTitle>
                  {response && (
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold" onClick={handleCopyResponse}>
                      {copied ? <Check className="h-3 w-3 mr-1 text-emerald-500" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? "COPIED" : "COPY"}
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0 flex-1 relative bg-muted/5">
                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[1px] z-10">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Waiting for response...</p>
                      </div>
                    </div>
                  ) : null}
                  
                  {response ? (
                    <div className="p-4 h-full">
                      <JsonViewer 
                        data={response} 
                        className="h-full max-h-[700px] bg-transparent border-none p-0" 
                      />
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 grayscale">
                      <Globe className="h-16 w-16 mb-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">No request sent yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
