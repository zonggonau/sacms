"use client"

import { useMemo } from "react"
import { 
  Search, CheckCircle2, AlertCircle, Info, 
  TrendingUp, BarChart3, Target, Lightbulb
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { analyzeSEO } from "@/lib/seo-analyzer"
import { cn } from "@/lib/utils"

interface SEOAnalyzerPanelProps {
  data: any
  fields: any[]
}

export function SEOAnalyzerPanel({ data, fields }: SEOAnalyzerPanelProps) {
  const analysis = useMemo(() => analyzeSEO(data, fields), [data, fields])

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500"
    if (score >= 50) return "text-amber-500"
    return "text-red-500"
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500"
    if (score >= 50) return "bg-amber-500"
    return "bg-red-500"
  }

  return (
    <Card className="border-none shadow-sm bg-card rounded-3xl overflow-hidden">
      <CardHeader className="bg-muted/10 border-b p-6">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-600" /> SEO Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Overall Score */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Content Health</span>
            <span className={cn("text-lg font-black", getScoreColor(analysis.score))}>
              {analysis.score}%
            </span>
          </div>
          <Progress value={analysis.score} className="h-2 bg-muted">
            <div 
              className={cn("h-full transition-all rounded-full", getScoreBg(analysis.score))} 
              style={{ width: `${analysis.score}%` }} 
            />
          </Progress>
        </div>

        {/* Breakdown */}
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Checklist</p>
          <div className="space-y-3">
            {analysis.results.map((res, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className={cn(
                  "mt-0.5 rounded-full p-0.5",
                  res.status === "good" ? "text-emerald-500 bg-emerald-50" : 
                  res.status === "warning" ? "text-amber-500 bg-amber-50" : "text-red-500 bg-red-50"
                )}>
                  {res.status === "good" ? <CheckCircle2 className="h-3.5 w-3.5" /> : 
                   res.status === "warning" ? <Info className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-foreground leading-none">{res.label}</p>
                  <p className="text-[10px] text-muted-foreground font-medium leading-tight">{res.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Tip */}
        <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
          <div className="flex items-center gap-2 text-emerald-700">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">SEO Pro Tip</span>
          </div>
          <p className="text-[11px] text-emerald-800/70 leading-relaxed font-medium">
            Include your primary keyword in the first paragraph and use H2 headers to structure long content.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
