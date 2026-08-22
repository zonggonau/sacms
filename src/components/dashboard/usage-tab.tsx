"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Loader2, Activity, Database, FileText, Globe, CheckCircle2, AlertTriangle } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

interface UsageTabProps {
  tenantSlug: string
}

export function UsageTab({ tenantSlug }: UsageTabProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/usage`)
        if (res.ok) {
          setData(await res.json())
        }
      } catch (error) {
        console.error("Failed to fetch usage data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchUsage()
  }, [tenantSlug])

  if (loading) {
    return (
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card">
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.error) {
    return (
      <Card className="rounded-2xl border border-destructive/40 shadow-xs bg-card">
        <CardContent className="flex items-center justify-center py-20 text-destructive text-xs font-bold">
          Gagal memuat data penggunaan kuota resource workspace.
        </CardContent>
      </Card>
    )
  }

  const { plan, usage, charts } = data

  const apiPercentage = Math.min(100, Math.round((usage.apiCalls / plan.max_api_calls) * 100)) || 0
  const storagePercentage = Math.min(100, Math.round((usage.storageMB / plan.max_storage) * 100)) || 0
  const ctPercentage = Math.min(100, Math.round((usage.contentTypes / plan.max_content_types) * 100)) || 0

  return (
    <div className="space-y-6">
      {/* Resource Quota Progress */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Kuota Resource & Penggunaan ({plan.name || "Free"})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Pantau pemakaian kapasitas API request, penyimpanan media, dan model konten aktif.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold uppercase rounded-full bg-primary/10 text-primary border-primary/20">
            {plan.name || "Plan"}
          </Badge>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* API Calls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center font-bold text-foreground">
                <Globe className="mr-1.5 h-3.5 w-3.5 text-primary" />
                API Request (30 Hari Terakhir)
              </div>
              <span className="font-mono text-muted-foreground text-[11px]">
                <strong className="text-foreground">{usage.apiCalls.toLocaleString()}</strong> / {plan.max_api_calls >= 999999 ? "Unlimited" : plan.max_api_calls.toLocaleString()}
              </span>
            </div>
            <Progress value={apiPercentage} className="h-2 rounded-full" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{apiPercentage}% kuota terpakai</span>
              {apiPercentage > 90 && (
                <span className="text-rose-500 font-bold flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Mendekati batas maksimum
                </span>
              )}
            </div>
          </div>

          {/* Media Storage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center font-bold text-foreground">
                <Database className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Kapasitas Media Storage
              </div>
              <span className="font-mono text-muted-foreground text-[11px]">
                <strong className="text-foreground">{usage.storageMB} MB</strong> / {plan.max_storage >= 999999 ? "Unlimited" : `${plan.max_storage} MB`}
              </span>
            </div>
            <Progress value={storagePercentage} className="h-2 rounded-full" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{storagePercentage}% kuota penyimpanan terpakai</span>
            </div>
          </div>

          {/* Content Types */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center font-bold text-foreground">
                <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Model Konten (Content Types)
              </div>
              <span className="font-mono text-muted-foreground text-[11px]">
                <strong className="text-foreground">{usage.contentTypes}</strong> / {plan.max_content_types >= 999999 ? "Unlimited" : plan.max_content_types}
              </span>
            </div>
            <Progress value={ctPercentage} className="h-2 rounded-full" />
            <div className="flex justify-between items-center text-[10px] text-muted-foreground">
              <span>{ctPercentage}% kapasitas model terpakai</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Traffic Chart */}
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Activity className="h-4 w-4 text-primary" /> 
            Grafik Trafik API Request (30 Hari Terakhir)
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Volume pemanggilan endpoint REST dan GraphQL harian.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="h-[260px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts?.apiUsage || []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.6} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getDate()}/${d.getMonth()+1}`
                  }}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))', 
                    borderRadius: '12px',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="calls" 
                  name="API Requests" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
