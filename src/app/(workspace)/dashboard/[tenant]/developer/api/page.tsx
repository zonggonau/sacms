"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Copy, Check, Send, Globe, Database, 
  Terminal, Code2, Key, Loader2, RefreshCw,
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
import { useToast } from "@/hooks/use-toast"
import { getContentTypesAction } from "@/actions/content-types"
import { getSingleTypesAction } from "@/actions/single-types"

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
    if (tenantSlug) setEndpoint(`/api/public/${tenantSlug}/content`)
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
        const [ctData, stData, settingsRes] = await Promise.all([
          getContentTypesAction(tenantSlug),
          getSingleTypesAction(tenantSlug),
          fetch(`/api/tenant/${tenantSlug}/settings`)
        ])
        if (ctData && !ctData.error) setContentTypes(ctData.contentTypes || [])
        if (stData && !stData.error) setSingleTypes(stData.singleTypes || [])
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json()
          const key = settingsData.settings?.apiKey
          if (key) {
            setApiKeys([{ id: 'default', name: 'Default API Key', token: key }])
            if (!selectedKey) setSelectedKey(key)
          } else {
            setApiKeys([])
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
      toast({ title: "Berhasil", description: "Spesifikasi OpenAPI telah diunduh" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Ekspor", description: e.message })
    } finally {
      setExporting(false)
    }
  }

  const handleDownloadAiPrompt = async () => {
    setExportingPrompt(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/developer/openapi?format=json`)
      if (!res.ok) throw new Error("Failed to fetch API specs")
      const data = await res.json()
      
      const promptContent = `# SaCMS API Integration Guide\n\nBase URL: \`${window.location.origin}/api/public/${tenantSlug}\`\n\n## Content Schemas\n\`\`\`json\n${JSON.stringify(data.components?.schemas || {}, null, 2)}\n\`\`\`\n`
      
      const blob = new Blob([promptContent], { type: "text/markdown" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${tenantSlug}-ai-skill.md`; document.body.appendChild(a); a.click()
      window.URL.revokeObjectURL(url); document.body.removeChild(a)
      toast({ title: "Berhasil", description: "File AI Skill Prompt telah diunduh" })
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal Ekspor", description: e.message })
    } finally {
      setExportingPrompt(false)
    }
  }

  const handleQuickSelect = (val: string) => {
    const [selectedMethod, kind, targetSlug] = val.split("|")
    setMethod(selectedMethod)
    if (kind === "single") {
      setEndpoint(`/api/public/${tenantSlug}/single/${targetSlug}`)
    } else {
      setEndpoint(`/api/public/${tenantSlug}/content/${targetSlug}`)
    }
  }

  const handleMethodChange = (m: string) => {
    setMethod(m)
    if (m === "POST" || m === "PATCH") {
      setRequestBody('{\n  "data": {}\n}')
    }
  }

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(requestBody)
      setRequestBody(JSON.stringify(parsed, null, 2))
      toast({ title: "JSON Diformat", description: "Struktur payload JSON valid" })
    } catch (e) {
      toast({ variant: "destructive", title: "JSON Tidak Valid", description: "Periksa kembali format JSON" })
    }
  }

  const handleSendRequest = async () => {
    if (!endpoint) return
    setLoading(true)
    setResponse(null)
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (selectedKey) {
        headers["Authorization"] = `Bearer ${selectedKey}`
      }

      const options: RequestInit = {
        method,
        headers,
      }

      if (method === "POST" || method === "PATCH") {
        options.body = requestBody
      }

      const res = await fetch(endpoint, options)
      const data = await res.json()
      setResponse(data)
      if (res.ok) toast({ title: "Request Berhasil", description: `Status: ${res.status}` })
      else toast({ variant: "destructive", title: `Error ${res.status}`, description: data.error || "Request gagal" })
    } catch (error: any) {
      setResponse({ error: error.message || "Gagal menghubungi server" })
      toast({ variant: "destructive", title: "Koneksi Error" })
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex bg-background text-foreground flex-1 flex-col w-full">
      <div className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-foreground">REST API Explorer</h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                Live Playground
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Uji coba request endpoint konten secara real-time dan unduh spesifikasi OpenAPI.
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-card border border-border/80 rounded-xl px-3 py-1 shadow-xs">
              <Key className="w-3.5 h-3.5 text-primary mr-2" />
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger className="h-7 min-w-[160px] border-none bg-transparent focus:ring-0 text-xs font-mono p-0">
                  <SelectValue placeholder="Pilih API Token..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  {apiKeys.length === 0 && <div className="p-2 text-xs text-muted-foreground text-center">Belum ada token</div>}
                  {apiKeys.map(key => (
                    <SelectItem key={key.id} value={key.token} className="text-xs font-mono rounded-lg">
                      {key.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              variant="outline" 
              className="h-9 rounded-xl border-border/80 text-xs font-bold shadow-xs hover:bg-muted"
              onClick={handleDownloadAiPrompt}
              disabled={exportingPrompt}
            >
              {exportingPrompt ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
              AI Skill (.md)
            </Button>
            <Button 
              variant="outline" 
              className="h-9 rounded-xl border-border/80 text-xs font-bold shadow-xs hover:bg-muted"
              onClick={handleDownloadOpenApi}
              disabled={exporting}
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
              OpenAPI Spec
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Request Builder */}
          <div className="xl:col-span-6 flex flex-col gap-6">
            
            <Card className="border border-border/80 rounded-2xl p-5 bg-card shadow-xs">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Generator Endpoint Cepat</Label>
                  <Select onValueChange={handleQuickSelect}>
                    <SelectTrigger className="h-9 bg-background border-border/80 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="w-3.5 h-3.5 text-primary" />
                        <SelectValue placeholder="Pilih rute endpoint otomatis..." />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border bg-card max-h-72">
                      <SelectGroup>
                        <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2">Collection Types</SelectLabel>
                        {method === 'GET' && contentTypes.map(ct => (
                          <SelectItem key={`get-${ct.id}`} value={`GET|content|${ct.slug}`} className="text-xs rounded-lg">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2">GET</span> List {ct.name}
                          </SelectItem>
                        ))}
                        {method === 'POST' && contentTypes.map(ct => (
                          <SelectItem key={`post-${ct.id}`} value={`POST|content|${ct.slug}`} className="text-xs rounded-lg">
                            <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">POST</span> Create {ct.name}
                          </SelectItem>
                        ))}
                        {method === 'PATCH' && contentTypes.map(ct => (
                          <SelectItem key={`patch-${ct.id}`} value={`PATCH|content|${ct.slug}/[id]`} className="text-xs rounded-lg">
                            <span className="font-bold text-amber-600 dark:text-amber-400 mr-2">PATCH</span> Update {ct.name}
                          </SelectItem>
                        ))}
                        {method === 'DELETE' && contentTypes.map(ct => (
                          <SelectItem key={`delete-${ct.id}`} value={`DELETE|content|${ct.slug}/[id]`} className="text-xs rounded-lg">
                            <span className="font-bold text-rose-600 dark:text-rose-400 mr-2">DELETE</span> Delete {ct.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      
                      {(method === 'GET' || method === 'PATCH') && singleTypes.length > 0 && (
                        <SelectGroup className="mt-2 pt-2 border-t border-border/60">
                          <SelectLabel className="text-[10px] uppercase font-bold text-muted-foreground px-2">Single Types</SelectLabel>
                          {method === 'GET' && singleTypes.map(st => (
                            <SelectItem key={`get-st-${st.id}`} value={`GET|single|${st.slug}`} className="text-xs rounded-lg">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 mr-2">GET</span> Read {st.name}
                            </SelectItem>
                          ))}
                          {method === 'PATCH' && singleTypes.map(st => (
                            <SelectItem key={`patch-st-${st.id}`} value={`PATCH|single|${st.slug}`} className="text-xs rounded-lg">
                              <span className="font-bold text-amber-600 dark:text-amber-400 mr-2">PATCH</span> Update {st.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Request URL & Metode</Label>
                  <div className="flex gap-2">
                    <Select value={method} onValueChange={handleMethodChange}>
                      <SelectTrigger className="w-[100px] h-9 bg-background border-border/80 rounded-xl text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="GET" className="text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg">GET</SelectItem>
                        <SelectItem value="POST" className="text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg">POST</SelectItem>
                        <SelectItem value="PATCH" className="text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg">PATCH</SelectItem>
                        <SelectItem value="DELETE" className="text-rose-600 dark:text-rose-400 font-bold text-xs rounded-lg">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      value={endpoint} 
                      onChange={e => setEndpoint(e.target.value)}
                      className="flex-1 h-9 bg-background border-border/80 rounded-xl font-mono text-xs"
                      placeholder="/api/public/..."
                    />
                  </div>
                </div>

                {(method === "POST" || method === "PATCH") && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-foreground">JSON Body Payload</Label>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 text-[10px] font-bold text-primary hover:bg-primary/10 px-2 rounded-lg"
                        onClick={handleFormatJson}
                      >
                        <Code2 className="w-3 h-3 mr-1" /> Format JSON
                      </Button>
                    </div>
                    <Textarea 
                      value={requestBody} 
                      onChange={e => setRequestBody(e.target.value)}
                      className="min-h-[160px] font-mono text-xs bg-muted/20 border-border/80 rounded-xl p-3"
                    />
                  </div>
                )}
                
                <Button 
                  className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs"
                  onClick={handleSendRequest}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                  KIRIM REQUEST
                </Button>
              </div>
            </Card>

            {/* Query Parameters Documentation */}
            <Card className="border border-border/80 rounded-2xl p-5 bg-card shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <Database className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Panduan Query Parameters</h3>
              </div>
              
              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <span className="font-bold text-foreground block">Paginasi & Pencarian:</span>
                  <div className="space-y-1.5">
                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                      <code className="text-xs font-mono text-primary font-bold">?page=1&pageSize=25</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Membagi hasil ke halaman tertentu (maksimal pageSize: 100).</p>
                    </div>
                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                      <code className="text-xs font-mono text-primary font-bold">?search=keyword</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Pencarian teks lengkap terindeks pada seluruh field teks.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-foreground block">Filter Lanjutan:</span>
                  <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60 space-y-1">
                    <code className="text-xs font-mono text-primary font-bold">?filters[title][$contains]=tutorial</code>
                    <p className="text-[10px] text-muted-foreground">Operator: $eq, $ne, $gt, $gte, $lt, $lte, $contains, $in, $notIn, $null, $notNull.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold text-foreground block">Sorting & Relasi:</span>
                  <div className="space-y-1.5">
                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                      <code className="text-xs font-mono text-primary font-bold">?sort=createdAt:desc</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Urutan data: asc (naik) atau desc (turun).</p>
                    </div>
                    <div className="bg-muted/30 p-2.5 rounded-xl border border-border/60">
                      <code className="text-xs font-mono text-primary font-bold">?populate=author,tags</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ekspansi data relasi konten.</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel: Response */}
          <div className="xl:col-span-6 flex flex-col gap-6 xl:sticky xl:top-8">
            <Card className="border border-border/80 rounded-2xl flex-1 min-h-[500px] flex flex-col overflow-hidden bg-card shadow-xs">
              <div className="bg-muted/20 border-b border-border/60 py-3 px-4 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Terminal className="h-3.5 w-3.5 text-primary" /> Respon Server
                </h3>
                {response && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs font-bold rounded-lg px-2 text-muted-foreground hover:text-foreground" 
                    onClick={handleCopyResponse}
                  >
                    {copied ? <Check className="h-3 w-3 mr-1 text-primary" /> : <Copy className="h-3 w-3 mr-1" />}
                    {copied ? "Disalin" : "Salin JSON"}
                  </Button>
                )}
              </div>
              
              <div className="p-4 flex-1 relative bg-background/40">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs font-semibold text-muted-foreground">Menunggu respon server...</p>
                  </div>
                ) : response ? (
                  <div className="h-full max-h-[700px] overflow-auto">
                    <JsonViewer data={response} className="bg-transparent border-none p-0 text-xs font-mono" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-28 text-muted-foreground/40 text-center">
                    <Globe className="h-10 w-10 mb-2" strokeWidth={1.5} />
                    <p className="text-xs font-bold text-muted-foreground">Siap Menerima Request</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">Pilih endpoint di sebelah kiri dan klik Kirim Request.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

      </div>
    </div>
  )
}
