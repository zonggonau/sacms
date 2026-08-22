"use client"

import { useState, useEffect, useMemo, useTransition } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel
} from "@/components/ui/select"
import { 
  Play, Copy, Check, Send, Globe, Database, 
  Terminal, Code2, Key, Loader2, RefreshCw,
  Info, Link as LinkIcon, FileDown, Sparkles,
  Layers, ExternalLink, CheckCircle2, AlertCircle, Clock
} from "lucide-react"
import { JsonViewer } from "@/components/ui/json-viewer"
import { useToast } from "@/hooks/use-toast"
import { getContentTypesAction } from "@/actions/content-types"
import { getSingleTypesAction } from "@/actions/single-types"
import { getApiTokensAction } from "@/actions/api-keys"
import { cn } from "@/lib/utils"

interface ApiTokenOption {
  id: string
  name: string
  token: string
}

interface ContentType {
  id: string
  name: string
  slug: string
  fields?: any[]
}

interface SingleType {
  id: string
  name: string
  slug: string
  fields?: any[]
}

export default function ApiExplorerPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const { toast } = useToast()

  const [method, setMethod] = useState("GET")
  const [endpoint, setEndpoint] = useState("")
  const [requestBody, setRequestBody] = useState('{\n  "data": {}\n}')

  const [response, setResponse] = useState<any>(null)
  const [responseStatus, setResponseStatus] = useState<number | null>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [singleTypes, setSingleTypes] = useState<SingleType[]>([])
  const [availableTokens, setAvailableTokens] = useState<ApiTokenOption[]>([])
  const [selectedToken, setSelectedToken] = useState("")
  
  const [exportingOpenApi, setExportingOpenApi] = useState(false)
  const [exportingAiSkill, setExportingAiSkill] = useState(false)
  const [copiedResponse, setCopiedResponse] = useState(false)
  const [copiedSnippet, setCopiedSnippet] = useState(false)

  useEffect(() => {
    if (tenantSlug && !endpoint) {
      setEndpoint(`/api/public/${tenantSlug}/content`)
    }
  }, [tenantSlug, endpoint])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  // Fetch schema and tokens
  useEffect(() => {
    const fetchData = async () => {
      if (!tenantSlug || status !== "authenticated") return
      try {
        const [ctData, stData, tokensData, settingsRes] = await Promise.all([
          getContentTypesAction(tenantSlug),
          getSingleTypesAction(tenantSlug),
          getApiTokensAction(tenantSlug),
          fetch(`/api/tenant/${tenantSlug}/settings`).catch(() => null)
        ])

        if (ctData && !ctData.error) {
          setContentTypes(ctData.contentTypes || [])
          // Auto set default endpoint to first content type if available
          if (ctData.contentTypes && ctData.contentTypes.length > 0) {
            setEndpoint(`/api/public/${tenantSlug}/content/${ctData.contentTypes[0].slug}`)
          }
        }

        if (stData && !stData.error) {
          setSingleTypes(stData.singleTypes || [])
        }

        const tokenList: ApiTokenOption[] = []

        // Load active user-created API tokens
        if (tokensData && !tokensData.error && Array.isArray(tokensData.tokens)) {
          tokensData.tokens.forEach((t: any) => {
            if (t.token) {
              tokenList.push({
                id: t.id,
                name: `${t.name} (${t.permissions?.join(", ") || "token"})`,
                token: t.token,
              })
            }
          })
        }

        setAvailableTokens(tokenList)
        if (tokenList.length > 0 && !selectedToken) {
          setSelectedToken(tokenList[0].token)
        }
      } catch (err) {
        console.error("Error fetching explorer data:", err)
      }
    }

    fetchData()
  }, [tenantSlug, status])

  const handleDownloadOpenApi = async () => {
    setExportingOpenApi(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/developer/openapi`)
      if (!res.ok) throw new Error("Gagal mengekspor OpenAPI")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${tenantSlug}-openapi.yaml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({ title: "OpenAPI Berhasil Diekspor", description: `${tenantSlug}-openapi.yaml telah diunduh.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Ekspor Gagal", description: err.message })
    } finally {
      setExportingOpenApi(false)
    }
  }

  const handleDownloadAiSkill = async () => {
    setExportingAiSkill(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/developer/ai-prompt`)
      if (!res.ok) throw new Error("Gagal mengunduh AI Skill")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${tenantSlug}-ai-skill.md`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({ title: "AI Skill Berhasil Diunduh", description: `${tenantSlug}-ai-skill.md telah diunduh.` })
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download Gagal", description: err.message })
    } finally {
      setExportingAiSkill(false)
    }
  }

  const generateDummyDataForSlug = (cleanSlug: string, type: string) => {
    let dummyData: Record<string, any> = {}
    const targetFields = type === "content" 
      ? contentTypes.find((c: any) => c.slug === cleanSlug)?.fields 
      : singleTypes.find((s: any) => s.slug === cleanSlug)?.fields
      
    if (targetFields && Array.isArray(targetFields)) {
      targetFields.forEach((f: any) => {
        const fieldType = (f.type || "").toLowerCase()
        if (["text", "textarea", "richtext", "string", "markdown"].includes(fieldType)) {
          dummyData[f.slug] = `Contoh ${f.name || f.slug}`
        } else if (["slug", "uid"].includes(fieldType)) {
          dummyData[f.slug] = `contoh-${f.slug}`
        } else if (fieldType === "email") {
          dummyData[f.slug] = "user@example.com"
        } else if (fieldType === "url") {
          dummyData[f.slug] = "https://example.com"
        } else if (fieldType === "phone") {
          dummyData[f.slug] = "+628123456789"
        } else if (["number", "integer", "currency", "rating"].includes(fieldType)) {
          dummyData[f.slug] = 100
        } else if (fieldType === "boolean") {
          dummyData[f.slug] = true
        } else if (["date", "datetime", "daterange"].includes(fieldType)) {
          dummyData[f.slug] = new Date().toISOString()
        } else if (["relation", "media", "file"].includes(fieldType)) {
          dummyData[f.slug] = `sample_${f.slug}_id`
        } else if (fieldType === "json") {
          dummyData[f.slug] = { key: "value" }
        } else if (["tags", "hashtags", "multiselect", "mediamultiple"].includes(fieldType)) {
          dummyData[f.slug] = ["item_1", "item_2"]
        } else {
          dummyData[f.slug] = "contoh nilai"
        }
      })
      return dummyData
    }
    return null
  }

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestBody)
      setRequestBody(JSON.stringify(parsed, null, 2))
      toast({ title: "JSON Diformat", description: "Struktur payload JSON telah dirapikan." })
    } catch {
      toast({ variant: "destructive", title: "Format Gagal", description: "Sintaks JSON tidak valid." })
    }
  }

  const handleQuickSelect = (value: string) => {
    const [m, type, slugPath] = value.split("|")
    setMethod(m)
    
    if (type === "content") {
      setEndpoint(`/api/public/${tenantSlug}/content/${slugPath}`)
    } else if (type === "single") {
      setEndpoint(`/api/public/${tenantSlug}/single/${slugPath}`)
    }

    if (m === "POST" || m === "PUT") {
      const cleanSlug = slugPath.split("/")[0]
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
    if (m === "POST" || m === "PUT") {
      const parts = endpoint.split("/")
      const contentIndex = parts.indexOf("content")
      const singleIndex = parts.indexOf("single")
      
      let cleanSlug = ""
      let type = ""
      
      if (contentIndex !== -1 && parts.length > contentIndex + 1) {
        cleanSlug = parts[contentIndex + 1].split("/")[0]
        type = "content"
      } else if (singleIndex !== -1 && parts.length > singleIndex + 1) {
        cleanSlug = parts[singleIndex + 1].split("/")[0]
        type = "single"
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
    if (!selectedToken.trim()) {
      toast({
        variant: "destructive",
        title: "Autentikasi Diperlukan",
        description: "Silakan pilih atau masukkan API Token untuk menguji endpoint publik.",
      })
      return
    }

    setLoading(true)
    setResponse(null)
    setResponseStatus(null)
    setResponseTime(null)

    const startTime = performance.now()

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${selectedToken.trim()}`
      }
      
      const options: RequestInit = { method, headers }
      
      if (method !== "GET" && method !== "DELETE") {
        try {
          const parsed = JSON.parse(requestBody)
          options.body = JSON.stringify(parsed)
          setRequestBody(JSON.stringify(parsed, null, 2))
        } catch {
          toast({
            variant: "destructive",
            title: "Payload JSON Tidak Valid",
            description: "Periksa kembali sintaks JSON di kolom request body.",
          })
          setLoading(false)
          return
        }
      }

      const res = await fetch(endpoint, options)
      const endTime = performance.now()
      setResponseTime(Math.round(endTime - startTime))
      setResponseStatus(res.status)

      const contentTypeHeader = res.headers.get("content-type") || ""
      if (contentTypeHeader.includes("application/json")) {
        const data = await res.json()
        setResponse(data)
      } else {
        const text = await res.text()
        try {
          setResponse(JSON.parse(text))
        } catch {
          setResponse({ status: res.status, statusText: res.statusText, rawBody: text })
        }
      }

      if (res.ok) {
        toast({ title: `Sukses (${res.status})`, description: "Permintaan API berhasil diproses." })
      } else {
        toast({
          variant: "destructive",
          title: `Respon ${res.status}`,
          description: "Server mengembalikan status error.",
        })
      }
    } catch (error: any) {
      const endTime = performance.now()
      setResponseTime(Math.round(endTime - startTime))
      setResponseStatus(500)
      setResponse({ error: error.message || "Gagal menghubungi server" })
      toast({ variant: "destructive", title: "Koneksi Gagal", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCopyResponse = () => {
    if (!response) return
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    setCopiedResponse(true)
    setTimeout(() => setCopiedResponse(false), 2000)
    toast({ title: "Tersalin!", description: "Respon JSON disalin ke clipboard." })
  }

  const generateCurlSnippet = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
    const fullUrl = endpoint.startsWith("http") ? endpoint : `${origin}${endpoint}`
    
    let curl = `curl -X ${method} "${fullUrl}" \\\n  -H "Authorization: Bearer ${selectedToken || "YOUR_API_TOKEN"}" \\\n  -H "Content-Type: application/json"`
    if (method === "POST" || method === "PUT") {
      curl += ` \\\n  -d '${requestBody.replace(/\n/g, "")}'`
    }
    return curl
  }

  const getMethodBadge = (m: string) => {
    switch (m) {
      case "GET":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-md">GET</Badge>
      case "POST":
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-bold rounded-md">POST</Badge>
      case "PUT":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold rounded-md">PUT</Badge>
      case "DELETE":
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-bold rounded-md">DELETE</Badge>
      default:
        return <Badge variant="outline" className="text-[10px] font-bold">{m}</Badge>
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Play className="h-4 w-4" />
                </div>
                <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-foreground">
                  REST API Explorer
                </h1>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-bold rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  Live Tester
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Uji endpoint REST API publik secara langsung, eksplorasi parameter query & filter Strapi-style, dan ekspor spesifikasi OpenAPI.
              </p>
            </div>

            {/* Header Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadAiSkill}
                disabled={exportingAiSkill}
                className="h-9 rounded-xl text-xs font-bold border-border/80"
              >
                {exportingAiSkill ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />}
                AI Skill Doc
              </Button>
              
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadOpenApi}
                disabled={exportingOpenApi}
                className="h-9 rounded-xl text-xs font-bold border-border/80"
              >
                {exportingOpenApi ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5 text-primary" />}
                OpenAPI Spec
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                className="h-9 rounded-xl text-xs font-bold border-border/80"
                asChild
              >
                <a href={`/dashboard/${tenantSlug}/developer/sdk`}>
                  <Code2 className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  SDK Docs
                  <ExternalLink className="w-3 h-3 ml-1 opacity-50" />
                </a>
              </Button>
            </div>
          </div>

          {/* Authentication Banner & Token Selector */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Kredensial Autentikasi API</p>
                  <p className="text-[11px] text-muted-foreground">
                    Header: <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-foreground font-semibold">Authorization: Bearer &lt;TOKEN&gt;</code>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-1 md:max-w-md">
                <Input
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                  placeholder="Masukkan API Key (cf_...)"
                  className="font-mono text-xs bg-muted/20 border-border/80 rounded-xl h-9 text-foreground flex-1"
                />
                {availableTokens.length > 0 ? (
                  <Select value={selectedToken} onValueChange={setSelectedToken}>
                    <SelectTrigger className="h-9 min-w-[130px] rounded-xl text-xs bg-background border-border/80 shrink-0">
                      <SelectValue placeholder="Pilih Key" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card">
                      {availableTokens.map((t) => (
                        <SelectItem key={t.id} value={t.token} className="text-xs font-mono">
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs rounded-xl border-border/80 shrink-0 font-bold"
                    asChild
                  >
                    <a href={`/dashboard/${tenantSlug}/developer/api-keys`}>
                      + Buat Key
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main 2-Column Explorer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Request Builder & Reference */}
            <div className="lg:col-span-6 space-y-6">
              
              {/* Request Builder Card */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-primary" />
                    Request Builder
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Pilih skema konten atau ketik endpoint untuk mengirim request.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  
                  {/* Quick Path Generator */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-primary" /> Quick Path Generator
                    </Label>
                    <Select onValueChange={handleQuickSelect}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-muted/20 border-border/80">
                        <SelectValue placeholder="Pilih rute otomatis dari skema..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectGroup>
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-3">
                            Collection Types
                          </SelectLabel>
                          {contentTypes.map((ct) => (
                            <SelectItem key={`get-${ct.id}`} value={`GET|content|${ct.slug}`} className="text-xs">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2 inline-block">GET</span> Daftar {ct.name}
                            </SelectItem>
                          ))}
                          {contentTypes.map((ct) => (
                            <SelectItem key={`post-${ct.id}`} value={`POST|content|${ct.slug}`} className="text-xs">
                              <span className="font-bold text-blue-600 dark:text-blue-400 mr-2 inline-block">POST</span> Buat {ct.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>

                        {singleTypes.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-3 pt-2">
                              Single Types
                            </SelectLabel>
                            {singleTypes.map((st) => (
                              <SelectItem key={`get-st-${st.id}`} value={`GET|single|${st.slug}`} className="text-xs">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2 inline-block">GET</span> Baca {st.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* HTTP Method & Endpoint URL */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Endpoint URL</Label>
                    <div className="flex gap-2">
                      <Select value={method} onValueChange={handleMethodChange}>
                        <SelectTrigger className="w-28 h-9 rounded-xl text-xs font-bold bg-background border-border/80 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-border bg-card">
                          <SelectItem value="GET" className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">GET</SelectItem>
                          <SelectItem value="POST" className="text-blue-600 dark:text-blue-400 font-bold text-xs">POST</SelectItem>
                          <SelectItem value="PUT" className="text-amber-600 dark:text-amber-400 font-bold text-xs">PUT</SelectItem>
                          <SelectItem value="DELETE" className="text-rose-600 dark:text-rose-400 font-bold text-xs">DELETE</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={endpoint}
                        onChange={(e) => setEndpoint(e.target.value)}
                        placeholder="/api/public/..."
                        className="font-mono text-xs bg-muted/20 border-border/80 rounded-xl h-9 text-foreground flex-1"
                      />
                    </div>
                  </div>

                  {/* JSON Payload (for POST / PUT) */}
                  {(method === "POST" || method === "PUT") && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">JSON Request Body</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleFormatJson}
                          className="h-6 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg px-2"
                        >
                          <Code2 className="w-3 h-3 mr-1" /> Rapikan JSON
                        </Button>
                      </div>
                      <Textarea
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        rows={8}
                        className="font-mono text-xs bg-muted/20 border-border/80 rounded-xl p-3 text-foreground"
                      />
                    </div>
                  )}

                  {/* Send Request Button */}
                  <Button
                    onClick={handleSendRequest}
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 rounded-xl shadow-xs"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {loading ? "Memproses Request..." : "Kirim Request (Send Request)"}
                  </Button>

                </CardContent>
              </Card>

              {/* Interactive Query & Filter Cheat Sheet */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      Parameter & Filter Cheat Sheet
                    </CardTitle>
                    <CardDescription className="text-[11px] text-muted-foreground mt-0.5">
                      Klik contoh parameter untuk langsung menambahkannya ke URL request.
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-3">
                  <Tabs defaultValue="filters" className="w-full">
                    <TabsList className="bg-muted/40 border border-border/60 p-0.5 rounded-xl grid grid-cols-4 h-8">
                      <TabsTrigger value="filters" className="rounded-lg text-[10px] font-bold py-1">
                        Filters
                      </TabsTrigger>
                      <TabsTrigger value="pagination" className="rounded-lg text-[10px] font-bold py-1">
                        Paging & Search
                      </TabsTrigger>
                      <TabsTrigger value="sort" className="rounded-lg text-[10px] font-bold py-1">
                        Sort & Fields
                      </TabsTrigger>
                      <TabsTrigger value="relations" className="rounded-lg text-[10px] font-bold py-1">
                        Populate & i18n
                      </TabsTrigger>
                    </TabsList>

                    {/* TAB 1: FILTERS */}
                    <TabsContent value="filters" className="space-y-2 pt-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { op: "$eq", label: "Sama dengan", sample: "filters[title][$eq]=Tutorial" },
                          { op: "$ne", label: "Tidak sama", sample: "filters[status][$ne]=ARCHIVED" },
                          { op: "$gt / $gte", label: "Lebih besar (angka/tgl)", sample: "filters[price][$gte]=50000" },
                          { op: "$lt / $lte", label: "Lebih kecil (angka/tgl)", sample: "filters[stock][$lte]=10" },
                          { op: "$contains", label: "Mengandung teks", sample: "filters[title][$contains]=react" },
                          { op: "$startsWith", label: "Awalan teks", sample: "filters[slug][$startsWith]=blog-" },
                          { op: "$endsWith", label: "Akhiran teks", sample: "filters[email][$endsWith]=@gmail.com" },
                          { op: "$in", label: "Cocok list koma", sample: "filters[category][$in]=tech,news" },
                          { op: "$null", label: "Bernilai NULL", sample: "filters[cover][$null]=true" },
                          { op: "$notNull", label: "Tidak NULL", sample: "filters[cover][$notNull]=true" },
                        ].map((item, idx) => (
                          <div 
                            key={idx}
                            onClick={() => {
                              const clean = endpoint.includes("?") ? `&${item.sample}` : `?${item.sample}`
                              setEndpoint(prev => `${prev}${clean}`)
                              toast({ title: "Parameter Ditambahkan", description: item.sample })
                            }}
                            className="p-2 rounded-xl bg-muted/20 border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between">
                              <code className="text-[10px] font-mono font-bold text-primary group-hover:underline">
                                {item.op}
                              </code>
                              <span className="text-[9px] text-muted-foreground group-hover:text-primary font-bold">+ Sisip</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{item.label}</p>
                          </div>
                        ))}
                      </div>

                      <div 
                        onClick={() => {
                          const orSample = "filters[$or][0][category][$eq]=news&filters[$or][1][price][$lt]=10000"
                          const clean = endpoint.includes("?") ? `&${orSample}` : `?${orSample}`
                          setEndpoint(prev => `${prev}${clean}`)
                          toast({ title: "Filter OR Ditambahkan" })
                        }}
                        className="p-2.5 rounded-xl bg-muted/20 border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group text-[11px]"
                      >
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-bold text-primary">Logika OR ($or):</span>
                          <span className="text-[9px] text-muted-foreground group-hover:text-primary font-bold">+ Sisip Query</span>
                        </div>
                        <code className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground block truncate mt-0.5">
                          filters[$or][0][category][$eq]=news&filters[$or][1][price][$lt]=10000
                        </code>
                      </div>
                    </TabsContent>

                    {/* TAB 2: PAGINATION & SEARCH */}
                    <TabsContent value="pagination" className="space-y-2 pt-2">
                      {[
                        { title: "Pagination Halaman", code: "page=1&pageSize=25", desc: "Membatasi hasil ke halaman 1 dengan 25 item (maks: 100)" },
                        { title: "Pagination Format Strapi", code: "pagination[page]=1&pagination[pageSize]=25", desc: "Format standar Strapi" },
                        { title: "Full-Text Search (FTS)", code: "search=kata_kunci", desc: "Pencarian cepat di semua teks terindeks PostgreSQL" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            const clean = endpoint.includes("?") ? `&${item.code}` : `?${item.code}`
                            setEndpoint(prev => `${prev}${clean}`)
                            toast({ title: "Ditambahkan ke URL", description: item.code })
                          }}
                          className="p-2.5 rounded-xl bg-muted/20 border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{item.title}</span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-primary font-bold">+ Sisipkan</span>
                          </div>
                          <code className="text-[11px] font-mono text-primary block mt-0.5">{item.code}</code>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      ))}
                    </TabsContent>

                    {/* TAB 3: SORT & FIELDS */}
                    <TabsContent value="sort" className="space-y-2 pt-2">
                      {[
                        { title: "Sort Terbaru (Desc)", code: "sort=createdAt:desc", desc: "Urutkan berdasarkan waktu pembuatan terbaru" },
                        { title: "Sort Dynamic Field (Asc)", code: "sort=price:asc", desc: "Urutkan berdasarkan field data JSON (misal harga terendah)" },
                        { title: "Field Selection", code: "fields=title,slug,price", desc: "Hanya ambil kolom tertentu untuk menghemat payload data" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            const clean = endpoint.includes("?") ? `&${item.code}` : `?${item.code}`
                            setEndpoint(prev => `${prev}${clean}`)
                            toast({ title: "Ditambahkan ke URL", description: item.code })
                          }}
                          className="p-2.5 rounded-xl bg-muted/20 border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{item.title}</span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-primary font-bold">+ Sisipkan</span>
                          </div>
                          <code className="text-[11px] font-mono text-primary block mt-0.5">{item.code}</code>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      ))}
                    </TabsContent>

                    {/* TAB 4: RELATIONS & I18N */}
                    <TabsContent value="relations" className="space-y-2 pt-2">
                      {[
                        { title: "Populate Semua Relasi", code: "populate=*", desc: "Ekspansi seluruh data relasi (author, category, tags)" },
                        { title: "Populate Relasi Spesifik", code: "populate=author,category", desc: "Ekspansi relasi tertentu saja" },
                        { title: "Locale / Bahasa", code: "locale=id", desc: "Ambil entri dalam bahasa/locale tertentu" },
                        { title: "Filter Status (Full Access)", code: "status=DRAFT", desc: "Hanya untuk token full-access untuk melihat draft" },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => {
                            const clean = endpoint.includes("?") ? `&${item.code}` : `?${item.code}`
                            setEndpoint(prev => `${prev}${clean}`)
                            toast({ title: "Ditambahkan ke URL", description: item.code })
                          }}
                          className="p-2.5 rounded-xl bg-muted/20 border border-border/50 hover:bg-primary/5 hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">{item.title}</span>
                            <span className="text-[10px] text-muted-foreground group-hover:text-primary font-bold">+ Sisipkan</span>
                          </div>
                          <code className="text-[11px] font-mono text-primary block mt-0.5">{item.code}</code>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                      ))}
                    </TabsContent>

                  </Tabs>
                </CardContent>
              </Card>

            </div>

            {/* RIGHT COLUMN: Response Inspector */}
            <div className="lg:col-span-6 space-y-6 lg:sticky lg:top-6">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden flex flex-col min-h-[550px]">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Server Response
                    </CardTitle>
                    {responseStatus !== null && (
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] font-bold font-mono rounded-full",
                          responseStatus >= 200 && responseStatus < 300
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        )}
                      >
                        {responseStatus}
                      </Badge>
                    )}
                    {responseTime !== null && (
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground rounded-full">
                        <Clock className="w-2.5 h-2.5 mr-1" />
                        {responseTime}ms
                      </Badge>
                    )}
                  </div>

                  {response && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyResponse}
                      className="h-8 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground"
                    >
                      {copiedResponse ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copiedResponse ? "Tersalin" : "Salin JSON"}
                    </Button>
                  )}
                </CardHeader>

                <CardContent className="p-0 flex-1 relative bg-background/50 flex flex-col">
                  {loading && (
                    <div className="absolute inset-0 bg-background/60 backdrop-blur-xs flex flex-col items-center justify-center z-10">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      <p className="text-xs font-bold text-muted-foreground">Memuat Respon Server...</p>
                    </div>
                  )}

                  {response ? (
                    <div className="p-4 flex-1 overflow-auto max-h-[700px]">
                      <JsonViewer 
                        data={response} 
                        className="bg-transparent border-none p-0 text-xs font-mono" 
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-4 text-muted-foreground">
                      <Globe className="h-10 w-10 mb-3 opacity-20 text-primary" />
                      <p className="text-xs font-bold text-foreground">Belum ada request yang dikirim</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs">
                        Pilih endpoint di kolom sebelah kiri dan klik <strong>Kirim Request</strong> untuk melihat respon server.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* cURL Snippet Card */}
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-4 pb-2 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-primary" /> cURL Command
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generateCurlSnippet())
                      setCopiedSnippet(true)
                      setTimeout(() => setCopiedSnippet(false), 2000)
                      toast({ title: "cURL Tersalin!" })
                    }}
                    className="h-7 text-[11px] font-bold rounded-lg text-primary hover:bg-primary/10"
                  >
                    {copiedSnippet ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                    Salin cURL
                  </Button>
                </CardHeader>
                <CardContent className="p-3 bg-neutral-950 text-neutral-100 rounded-b-2xl overflow-x-auto font-mono text-[11px]">
                  <pre className="whitespace-pre-wrap">{generateCurlSnippet()}</pre>
                </CardContent>
              </Card>

            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
