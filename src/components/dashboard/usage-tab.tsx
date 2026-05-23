"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, Activity, Database, FileText, Globe } from "lucide-react"
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
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20 text-destructive">
          Failed to load usage data.
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
      <Card>
        <CardHeader>
          <CardTitle>Usage & Limits</CardTitle>
          <CardDescription>Monitor your workspace resource usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center font-medium">
                <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                API Calls (Last 30 Days)
              </div>
              <span className="text-muted-foreground">
                {usage.apiCalls.toLocaleString()} / {plan.max_api_calls.toLocaleString()}
              </span>
            </div>
            <Progress value={apiPercentage} className={apiPercentage > 90 ? "bg-destructive/20" : ""} />
            {apiPercentage > 90 && <p className="text-xs text-destructive">Approaching limit</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center font-medium">
                <Database className="mr-2 h-4 w-4 text-muted-foreground" />
                Media Storage
              </div>
              <span className="text-muted-foreground">
                {usage.storageMB} MB / {plan.max_storage} MB
              </span>
            </div>
            <Progress value={storagePercentage} className={storagePercentage > 90 ? "bg-destructive/20" : ""} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center font-medium">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                Content Types
              </div>
              <span className="text-muted-foreground">
                {usage.contentTypes} / {plan.max_content_types}
              </span>
            </div>
            <Progress value={ctPercentage} className={ctPercentage > 90 ? "bg-destructive/20" : ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> API Traffic (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.apiUsage} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => {
                    const d = new Date(val)
                    return `${d.getDate()}/${d.getMonth()+1}`
                  }}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '6px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="calls" 
                  name="API Requests" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
